const db = require("../database/db");

// ======================================
// GET USER ALLERGIES
// ======================================

const getUserAllergies = async (req, res) => {
    try {
        const [allergies] = await db.query(
            `SELECT id, allergen_name, reaction, severity, created_at
             FROM user_allergies
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.userId]
        );

        res.json({
            success: true,
            allergies
        });

    } catch (error) {
        console.error("Get Allergies Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve allergies"
        });
    }
};


// ======================================
// ADD USER ALLERGY
// ======================================

const addUserAllergy = async (req, res) => {
    try {
        const {
            allergen_name,
            reaction,
            severity
        } = req.body;

        if (!allergen_name || !allergen_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Allergen name is required"
            });
        }

        const allowedSeverities = [
            "mild",
            "moderate",
            "severe",
            "unknown"
        ];

        const selectedSeverity =
            (severity || "unknown").toLowerCase();

        if (!allowedSeverities.includes(selectedSeverity)) {
            return res.status(400).json({
                success: false,
                message: "Invalid allergy severity"
            });
        }

        const [result] = await db.query(
            `INSERT INTO user_allergies
            (user_id, allergen_name, reaction, severity)
            VALUES (?, ?, ?, ?)`,
            [
                req.user.userId,
                allergen_name.trim(),
                reaction || null,
                selectedSeverity
            ]
        );

        res.status(201).json({
            success: true,
            message: "Allergy added successfully",
            allergyId: result.insertId
        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This allergy already exists"
            });
        }

        console.error("Add Allergy Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save allergy"
        });
    }
};


// ======================================
// DELETE USER ALLERGY
// ======================================

const deleteUserAllergy = async (req, res) => {
    try {
        const allergyId = Number(req.params.allergyId);

        if (!Number.isInteger(allergyId) || allergyId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid allergy ID"
            });
        }

        const [result] = await db.query(
            `DELETE FROM user_allergies
             WHERE id = ? AND user_id = ?`,
            [
                allergyId,
                req.user.userId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Allergy not found"
            });
        }

        res.json({
            success: true,
            message: "Allergy deleted successfully"
        });

    } catch (error) {
        console.error("Delete Allergy Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete allergy"
        });
    }
};


// ======================================
// ANALYZE PRESCRIPTION ALLERGIES
// ======================================

const analyzePrescriptionAllergies = async (req, res) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription ID"
            });
        }

        const [medicines] = await db.query(
            `SELECT DISTINCT
                pm.medicine_id,
                COALESCE(m.name, pm.original_ocr_name, 'Unknown medicine') AS name,
                m.generic_name,
                pm.original_ocr_name,
                pm.recognition_status,
                pm.review_status,
                pm.review_reasons,
                pm.original_ocr_text
             FROM prescription_medicines pm
             LEFT JOIN medicines m ON m.id = pm.medicine_id
             WHERE pm.prescription_id = ?`,
            [prescriptionId]
        );

        const [allergies] = await db.query(
            `SELECT allergen_name, reaction, severity
             FROM user_allergies
             WHERE user_id = ?`,
            [req.user.userId]
        );

        // Fetch ingredients only for medicines in this prescription.
        const medicineIds = [
            ...new Set(
                medicines
                    .map(medicine => medicine.medicine_id)
                    .filter(id => id !== null)
            )
        ];

        let ingredientRows = [];

        if (medicineIds.length > 0) {
            const [rows] = await db.query(
                `SELECT DISTINCT
                    mi.medicine_id,
                    ai.name AS ingredient_name
                 FROM medicine_ingredients mi
                 JOIN active_ingredients ai
                    ON ai.id = mi.ingredient_id
                 WHERE mi.medicine_id IN (?)`,
                [medicineIds]
            );

            ingredientRows = rows;
        }

        const normalize = value =>
            String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const parseReviewReasons = value => {
            if (!value) return [];

            if (Array.isArray(value)) return value;

            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return ["Stored review information could not be parsed"];
            }
        };

        const ingredientMap = new Map();

        for (const row of ingredientRows) {
            const key = String(row.medicine_id);

            if (!ingredientMap.has(key)) {
                ingredientMap.set(key, []);
            }

            ingredientMap.get(key).push(row.ingredient_name);
        }

        const potentialMatches = [];
        const unmatchedMedicines = [];

        for (const medicine of medicines) {
            const ingredientNames = medicine.medicine_id === null
                ? []
                : ingredientMap.get(String(medicine.medicine_id)) || [];

            const medicineNames = [
                medicine.name,
                medicine.generic_name,
                medicine.original_ocr_name,
                ...ingredientNames
            ].filter(Boolean);

            const matchedAllergies = allergies.filter(allergy =>
                medicineNames.some(name =>
                    normalize(name) === normalize(allergy.allergen_name)
                )
            );

            const reviewReasons = parseReviewReasons(
                medicine.review_reasons
            );

            const result = {
                medicine: medicine.name,
                originalOcrName: medicine.original_ocr_name,
                recognitionStatus: medicine.recognition_status,
                reviewStatus: medicine.review_status || "not_required",
                reviewReasons,
                originalOcrText: medicine.original_ocr_text
            };

            if (matchedAllergies.length > 0) {
                potentialMatches.push({
                    ...result,
                    potentialAllergyMatches: matchedAllergies
                });
            } else {
                unmatchedMedicines.push(result);
            }
        }

        const unrecognizedMedicines = medicines.filter(
            medicine => medicine.medicine_id === null
        );

        const reviewRequiredMedicines = medicines.filter(
            medicine => medicine.review_status === "needs_review"
        );

        res.json({
            success: true,
            prescriptionId,
            totalMedicinesChecked: medicines.length,
            totalAllergiesOnProfile: allergies.length,
            potentialMatches,
            medicinesWithoutExactAllergyMatch: unmatchedMedicines,
            unrecognizedMedicines,
            reviewRequiredMedicines,
            unrecognizedCount: unrecognizedMedicines.length,
            reviewRequiredCount: reviewRequiredMedicines.length,
            assessmentNote:
                "Checks exact matches against medicine names, generic names and mapped active ingredients. Unrecognized medicines and medicines requiring review may have incomplete assessments. No exact match does not prove safety. Cross-reactivity is not assessed."
        });

    } catch (error) {
        console.error("Allergy Analysis Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to analyze prescription allergies"
        });
    }
};

// ======================================

module.exports = {
    getUserAllergies,
    addUserAllergy,
    deleteUserAllergy,
    analyzePrescriptionAllergies
};