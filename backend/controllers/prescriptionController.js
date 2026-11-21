const {
    analyzeDosage
} = require("../services/dosageAnalysisService");

const {
    analyzePrescriptionInteractions
} = require("../services/drugInteractionService");

const {
    analyzeFDAInteractions
} = require("../services/fdaInteractionAnalysisService");

const {
    saveDrugLabelReferences
} = require("../services/drugLabelService");

const {
    extractTextWithConfidence
} = require("../services/ocrService");

const {
    findMedicinesInText,
    extractMedicineDetails
} = require("../services/medicineService");

const { processHandwrittenPrescription } = require("../services/trocrPipelineService");
const db = require("../database/db");

// =====================================================
// HELPER: NORMALIZE CONFIDENCE VALUES TO 0 - 100% SCALE
// =====================================================
function normalizeConfidence(val) {
    if (val === null || val === undefined || isNaN(val)) return null;
    let num = parseFloat(val);
    // If represented as 0.0 - 1.0 fraction (e.g. 0.95), convert to percentage
    if (num > 0 && num <= 1) {
        num = num * 100;
    }
    // Clamp to valid 0.00 - 100.00 range
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    return parseFloat(num.toFixed(2));
}

// =====================================================
// TEST API
// =====================================================
const testPrescriptionAPI = (req, res) => {
    res.json({
        message: "Prescription Controller is working!"
    });
};

// =====================================================
// GET MEDICINES CATALOG
// =====================================================
const getMedicines = async (req, res) => {
    try {
        const [medicines] = await db.query(
            "SELECT * FROM medicines ORDER BY name ASC"
        );
        res.json({
            success: true,
            medicines
        });
    } catch (error) {
        console.error("Medicine Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch medicines"
        });
    }
};

// =====================================================
// UPLOAD + OCR + MEDICINE EXTRACTION
// =====================================================
const uploadPrescription = async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No prescription file uploaded"
            });
        }

        const userId = req.user.userId || req.user.id;
        const prescriptionType = String(req.body.prescriptionType || "printed").toLowerCase();
        const sectionType = String(req.body.sectionType || "existing").toLowerCase(); // 'existing' or 'new'

        if (!["printed", "handwritten"].includes(prescriptionType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription type. Use printed or handwritten."
            });
        }

        console.log(`\nProcessing prescription: type=${prescriptionType}, section=${sectionType}`);

        let extractedText = "";
        let ocrConfidence = null;
        let medicineDetails = [];

        // PIPELINE 1: PRINTED PRESCRIPTION (Tesseract)
        if (prescriptionType === "printed") {
            const ocrResult = await extractTextWithConfidence(req.file.path);
            extractedText = ocrResult.text || "";
            ocrConfidence = normalizeConfidence(ocrResult.confidence);

            const detectedMedicines = await findMedicinesInText(extractedText);
            medicineDetails = extractMedicineDetails(extractedText, detectedMedicines);
        }
        // PIPELINE 2: HANDWRITTEN PRESCRIPTION (TrOCR)
        else {
            try {
                const trocrResult = await processHandwrittenPrescription(req.file.path);
                if (trocrResult.success) {
                    extractedText = (trocrResult.rawOcr.entries || [])
                        .map(entry => entry.recognized_text || "")
                        .join("\n");

                    const matchedEntries = trocrResult.medicineMatching.entries || [];
                    medicineDetails = matchedEntries.map(entry => ({
                        id: entry.id ?? null,
                        dosage: Array.isArray(entry.dosage) ? entry.dosage.join(", ") : String(entry.dosage || ""),
                        frequency: Array.isArray(entry.frequency) ? entry.frequency.join(", ") : String(entry.frequency || ""),
                        duration: Array.isArray(entry.duration) ? entry.duration.join(", ") : String(entry.duration || ""),
                        originalOcrName: entry.originalOcrName || "Unknown medicine",
                        recognitionStatus: entry.recognitionStatus || "unrecognized",
                        matchConfidence: normalizeConfidence(entry.matchConfidence) ?? 75.0,
                        medicineCandidates: entry.medicineCandidates || [],
                        recognitionReviewStatus: entry.recognitionReviewStatus || "needs_review",
                        reviewReasons: entry.reviewReasons || [],
                        originalOcrText: entry.originalOcrText || ""
                    }));
                }
            } catch (err) {
                console.warn("TrOCR pipeline encountered issue, falling back to printed OCR:", err.message);
                const ocrResult = await extractTextWithConfidence(req.file.path);
                extractedText = ocrResult.text || "";
                ocrConfidence = normalizeConfidence(ocrResult.confidence) ?? 65.0;
                const detectedMedicines = await findMedicinesInText(extractedText);
                medicineDetails = extractMedicineDetails(extractedText, detectedMedicines);
            }
        }

        // DATABASE TRANSACTION
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const normOcrConfidence = normalizeConfidence(ocrConfidence);

        const [prescriptionResult] = await connection.query(
            `INSERT INTO prescriptions
            (user_id, file_path, extracted_text, section_type, prescription_type, ocr_engine, ocr_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                req.file.path,
                extractedText,
                sectionType,
                prescriptionType,
                prescriptionType === "printed" ? "Tesseract" : "TrOCR",
                normOcrConfidence
            ]
        );

        const prescriptionId = prescriptionResult.insertId;

        // Save extracted medicines
        for (const medicine of medicineDetails) {
            const rawConfidence = medicine.matchConfidence;
            const normConfidence = normalizeConfidence(rawConfidence);

            const status = ["recognized", "needs_review", "unrecognized"].includes(medicine.recognitionStatus)
                ? medicine.recognitionStatus
                : "needs_review";

            await connection.query(
                `INSERT INTO prescription_medicines
                (
                    prescription_id,
                    medicine_id,
                    dosage,
                    frequency,
                    duration,
                    original_ocr_name,
                    recognition_status,
                    match_confidence,
                    review_status,
                    review_reasons,
                    original_ocr_text
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    prescriptionId,
                    medicine.id || null,
                    medicine.dosage || null,
                    medicine.frequency || null,
                    medicine.duration || null,
                    medicine.originalOcrName || "Unknown medicine",
                    status,
                    normConfidence,
                    medicine.recognitionReviewStatus ||
                        (status === "recognized" ? "not_required" : "needs_review"),
                    JSON.stringify(medicine.reviewReasons || []),
                    medicine.originalOcrText || medicine.originalOcrName || null
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        const recognizedCount = medicineDetails.filter(m => m.recognitionStatus === "recognized").length;
        const needsReviewCount = medicineDetails.filter(m => m.recognitionStatus === "needs_review" || m.recognitionReviewStatus === "needs_review").length;
        const unrecognizedCount = medicineDetails.filter(m => m.recognitionStatus === "unrecognized").length;

        return res.json({
            success: true,
            message: "Prescription processed successfully",
            prescriptionId,
            sectionType,
            prescriptionType,
            ocrEngine: prescriptionType === "printed" ? "Tesseract" : "TrOCR",
            file: req.file.filename,
            extractedText,
            ocrConfidence: normOcrConfidence,
            detectedMedicines: medicineDetails.map(m => ({
                ...m,
                matchConfidence: normalizeConfidence(m.matchConfidence)
            })),
            savedMedicineCount: medicineDetails.length,
            recognizedCount,
            needsReviewCount,
            unrecognizedCount
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }
        console.error("Prescription Processing Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process prescription: " + error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// =====================================================
// CONFIRM PRESCRIPTION MEDICINES DIRECTLY TO SECTION A OR B
// =====================================================
const confirmPrescriptionToSection = async (req, res) => {
    let connection;
    try {
        const userId = req.user.userId || req.user.id;
        const { prescriptionId, sectionType, selectedMedicines } = req.body;

        if (!sectionType || !["existing", "new"].includes(sectionType)) {
            return res.status(400).json({
                success: false,
                message: "Valid sectionType ('existing' or 'new') is required"
            });
        }

        if (!Array.isArray(selectedMedicines) || selectedMedicines.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one medicine must be selected for confirmation"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        let count = 0;
        for (const item of selectedMedicines) {
            const medName = item.medicine_name || item.name || item.originalOcrName;
            if (!medName) continue;

            await connection.query(`
                INSERT INTO user_medications
                (user_id, section_type, medicine_id, medicine_name, generic_name, strength, dosage, frequency, duration, source, prescription_id, is_confirmed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ocr', ?, 1)
            `, [
                userId,
                sectionType,
                item.medicine_id || item.id || null,
                medName,
                item.generic_name || null,
                item.strength || null,
                item.dosage || null,
                item.frequency || null,
                item.duration || null,
                prescriptionId || null
            ]);
            count++;
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Successfully confirmed and added ${count} medicines to ${sectionType === 'existing' ? 'Previous Medications (Section A)' : 'New Medications (Section B)'}.`,
            confirmedCount: count
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Confirm Prescription Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to confirm medicines: " + error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// =====================================================
// GET USER PRESCRIPTIONS
// =====================================================
const getUserPrescriptions = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const [prescriptions] = await db.query(`
            SELECT p.*,
                   (SELECT COUNT(*) FROM prescription_medicines pm WHERE pm.prescription_id = p.id) as medicine_count
            FROM prescriptions p
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            prescriptions
        });
    } catch (error) {
        console.error("Get User Prescriptions Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch prescriptions: " + error.message
        });
    }
};

// =====================================================
// GET PRESCRIPTION BY ID
// =====================================================
const getPrescriptionById = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const pId = Number(req.params.id);

        const [prescriptions] = await db.query(
            "SELECT * FROM prescriptions WHERE id = ? AND user_id = ?",
            [pId, userId]
        );

        if (prescriptions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Prescription not found"
            });
        }

        const [medicines] = await db.query(`
            SELECT pm.*, m.name as matched_name, m.generic_name
            FROM prescription_medicines pm
            LEFT JOIN medicines m ON pm.medicine_id = m.id
            WHERE pm.prescription_id = ?
        `, [pId]);

        res.json({
            success: true,
            prescription: prescriptions[0],
            medicines
        });
    } catch (error) {
        console.error("Get Prescription Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch prescription details"
        });
    }
};

// Existing analysis routes for backward compatibility
const checkDrugInteractions = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);
        const result = await analyzePrescriptionInteractions(prescriptionId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkFDAInteractions = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);
        const result = await analyzeFDAInteractions(prescriptionId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkDosage = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);
        const result = await analyzeDosage(prescriptionId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    testPrescriptionAPI,
    getMedicines,
    uploadPrescription,
    confirmPrescriptionToSection,
    getUserPrescriptions,
    getPrescriptionById,
    checkDrugInteractions,
    checkFDAInteractions,
    checkDosage
};
