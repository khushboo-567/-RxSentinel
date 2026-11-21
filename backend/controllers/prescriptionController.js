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
// TEST API
// =====================================================

const testPrescriptionAPI = (req, res) => {
    res.json({
        message: "Prescription Controller is working!"
    });
};


// =====================================================
// GET MEDICINES
// =====================================================

const getMedicines = async (req, res) => {
    try {

        const [medicines] = await db.query(
            "SELECT * FROM medicines"
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

        const userId = req.user.userId;

        // Missing type defaults to printed to preserve existing frontend behaviour.
        const prescriptionType = String(
            req.body.prescriptionType || "printed"
        ).toLowerCase();

        if (!["printed", "handwritten"].includes(prescriptionType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription type. Use printed or handwritten."
            });
        }

        console.log("\nStarting prescription processing...");
        console.log("Prescription type:", prescriptionType);

        let extractedText = "";
        let ocrConfidence = null;
        let medicineDetails = [];
        let ocrResult = null;

        // =====================================================
        // PIPELINE 1: PRINTED PRESCRIPTION - EXISTING TESSERACT
        // =====================================================

        if (prescriptionType === "printed") {
            console.log("Using existing Tesseract pipeline...");

            ocrResult = await extractTextWithConfidence(
                req.file.path
            );

            extractedText = ocrResult.text || "";
            ocrConfidence = ocrResult.confidence ?? null;

            const detectedMedicines = await findMedicinesInText(
                extractedText
            );

            medicineDetails = extractMedicineDetails(
                extractedText,
                detectedMedicines
            );

            console.log("Printed OCR completed.");
            console.log("OCR Confidence:", ocrConfidence);
        }

        // =====================================================
        // PIPELINE 2: HANDWRITTEN PRESCRIPTION - TrOCR
        // =====================================================

        else {
            console.log("Using local TrOCR pipeline...");

            const trocrResult = await processHandwrittenPrescription(
                req.file.path
            );

            if (!trocrResult.success) {
                throw new Error(
                    "Handwritten prescription processing failed."
                );
            }

            extractedText = (
                trocrResult.rawOcr.entries || []
            ).map(entry => entry.recognized_text || "")
             .join("\n");

            const matchedEntries =
                trocrResult.medicineMatching.entries || [];

            medicineDetails = matchedEntries.map(entry => ({
                id: entry.id ?? null,

                dosage: Array.isArray(entry.dosage)
                    ? entry.dosage.join(", ")
                    : String(entry.dosage || ""),

                frequency: Array.isArray(entry.frequency)
                    ? entry.frequency.join(", ")
                    : String(entry.frequency || ""),

                duration: Array.isArray(entry.duration)
                    ? entry.duration.join(", ")
                    : String(entry.duration || ""),

                originalOcrName:
                    entry.originalOcrName || "Unknown medicine",

                recognitionStatus:
                    entry.recognitionStatus || "unrecognized",

                matchConfidence:
                    entry.matchConfidence ?? null,

                medicineCandidates:
                    entry.medicineCandidates || [],

                recognitionReviewStatus:
                    entry.recognitionReviewStatus || "needs_review",

                reviewReasons:
                    entry.reviewReasons || [],

                originalOcrText:
                    entry.originalOcrText || ""
            }));

            console.log("TrOCR processing completed.");
        }

        // =====================================================
        // DATABASE TRANSACTION - COMMON FOR BOTH PIPELINES
        // =====================================================

        connection = await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [prescriptionResult] = await connection.query(
            `INSERT INTO prescriptions
            (user_id, file_path, extracted_text)
            VALUES (?, ?, ?)`,
            [
                userId,
                req.file.path,
                extractedText
            ]
        );

        const prescriptionId = prescriptionResult.insertId;

        // Save extracted medicines.
        for (const medicine of medicineDetails) {
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
                    medicine.id,
                    medicine.dosage || null,
                    medicine.frequency || null,
                    medicine.duration || null,
                    medicine.originalOcrName || "Unknown medicine",
                    medicine.recognitionStatus,
                    medicine.matchConfidence ?? null,
                    medicine.recognitionReviewStatus ||
                        (medicine.recognitionStatus === "recognized" ? "not_required" : "needs_review"),
                    JSON.stringify(medicine.reviewReasons || []),
                    medicine.originalOcrText || medicine.originalOcrName || null
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        // =====================================================
        // API RESPONSE
        // =====================================================

        const recognizedCount = medicineDetails.filter(
            medicine => medicine.recognitionStatus === "recognized"
        ).length;

        const needsReviewCount = medicineDetails.filter(
            medicine =>
                medicine.recognitionStatus === "needs_review" ||
                medicine.recognitionReviewStatus === "needs_review"
        ).length;

        const unrecognizedCount = medicineDetails.filter(
            medicine => medicine.recognitionStatus === "unrecognized"
        ).length;

        return res.json({
            success: true,
            message: "Prescription processed and medicine details saved successfully",

            prescriptionId,
            userId,

            prescriptionType,
            ocrEngine: prescriptionType === "printed"
                ? "Tesseract"
                : "TrOCR",

            file: req.file.filename,
            extractedText,
            ocrConfidence,

            detectedMedicines: medicineDetails,
            savedMedicineCount: medicineDetails.length,

            recognizedCount,
            needsReviewCount,
            unrecognizedCount
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error(
            "Prescription Processing Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to process prescription",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// DRUG INTERACTION ANALYSIS
// =====================================================

const checkDrugInteractions = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription ID"
            });
        }

        const result = await analyzePrescriptionInteractions(
            prescriptionId
        );

        if (result.totalMedicines === 0) {
            return res.status(404).json({
                success: false,
                message: "No medicines found for this prescription"
            });
        }

        res.json({
            success: true,
            message: "Drug interaction analysis completed",
            result
        });

    } catch (error) {
        console.error("Drug Interaction Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to analyze drug interactions"
        });
    }
};

// =====================================================
// FDA INTERACTION ANALYSIS
// =====================================================

const checkFDAInteractions = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription ID"
            });
        }

        // STEP 1: FETCH RECOGNIZED MEDICINES
        const [medicines] = await db.query(
            `SELECT DISTINCT
                m.id,
                m.name,
                COALESCE(m.generic_name, m.name) AS generic_name
             FROM prescription_medicines pm
             JOIN medicines m ON pm.medicine_id = m.id
             WHERE pm.prescription_id = ?
               AND pm.recognition_status = 'recognized'`,
            [prescriptionId]
        );

        // STEP 2: HANDLE NO RECOGNIZED MEDICINES
        if (medicines.length === 0) {
            return res.status(200).json({
                success: true,
                message: "FDA analysis could not be performed because no medicines were recognized.",
                analysisStatus: "not_assessed",
                recognizedMedicineCount: 0,
                retrievalResults: [],
                result: {
                    status: "not_assessed",
                    totalMedicines: 0,
                    interactions: [],
                    unassessedPairs: [],
                    message: "Please confirm or correct the detected medicine names before running FDA analysis."
                }
            });
        }

        // STEP 3: RETRIEVE FDA LABEL REFERENCES
        const retrievalResults = [];

        for (const medicine of medicines) {
            try {
                const result = await saveDrugLabelReferences(
                    medicine.id,
                    medicine.generic_name
                );

                retrievalResults.push(result);

            } catch (error) {
                console.error(
                    `FDA retrieval failed for ${medicine.name}:`,
                    error.message
                );

                retrievalResults.push({
                    medicine: medicine.name,
                    error: "FDA reference retrieval failed"
                });
            }
        }

        // STEP 4: ANALYZE AVAILABLE FDA FINDINGS
        const result = await analyzeFDAInteractions(prescriptionId);

        res.json({
            success: true,
            message: "FDA reference analysis completed",
            analysisStatus: "completed",
            recognizedMedicineCount: medicines.length,
            retrievalResults,
            result
        });

    } catch (error) {
        console.error("FDA Interaction Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to analyze FDA interaction references"
        });
    }
};

// =====================================================
// DOSAGE ANALYSIS
// =====================================================

const checkDosage = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription ID"
            });
        }

        const result = await analyzeDosage(prescriptionId);

        if (result.totalMedicines === 0) {
            return res.status(404).json({
                success: false,
                message: "No medicines found for this prescription"
            });
        }

        res.json({
            success: true,
            message: "Dosage analysis completed",
            result
        });

    } catch (error) {
        console.error("Dosage Analysis Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to analyze dosage instructions"
        });
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    testPrescriptionAPI,
    getMedicines,
    uploadPrescription,
    checkDrugInteractions,
    checkFDAInteractions,
     checkDosage
};