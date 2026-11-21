const db = require("../database/db");

const parseReviewReasons = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return ["Stored review information could not be parsed"];
    }
};

const analyzeDosage = async (prescriptionId) => {

    const [medicines] = await db.query(
        `SELECT
            pm.medicine_id,
            COALESCE(m.name, pm.original_ocr_name, 'Unknown medicine') AS name,
            pm.original_ocr_name,
            pm.recognition_status,
            pm.match_confidence,
            pm.review_status,
            pm.review_reasons,
            pm.original_ocr_text,
            pm.dosage,
            pm.frequency,
            pm.duration
         FROM prescription_medicines pm
         LEFT JOIN medicines m ON pm.medicine_id = m.id
         WHERE pm.prescription_id = ?`,
        [prescriptionId]
    );

    const results = medicines.map(medicine => {

        const missingInformation = [];
        const observations = [];
        const reviewReasons = parseReviewReasons(
            medicine.review_reasons
        );

        if (!medicine.dosage) {
            missingInformation.push(
                "Strength information is missing"
            );
        }

        if (!medicine.frequency) {
            missingInformation.push(
                "Frequency information is missing"
            );
        }

        if (!medicine.duration) {
            observations.push(
                "Duration is not specified"
            );
        }

        if (medicine.recognition_status !== "recognized") {
            observations.push(
                "Medicine identity requires verification"
            );
        }

        if (medicine.review_status === "needs_review") {
            observations.push(
                "Prescription information requires manual verification"
            );
        }

        observations.push(...reviewReasons);

        return {
            medicine: medicine.name,
            originalOcrName: medicine.original_ocr_name,
            recognitionStatus: medicine.recognition_status,
            matchConfidence: medicine.match_confidence,
            reviewStatus: medicine.review_status || "not_required",
            reviewReasons,
            originalOcrText: medicine.original_ocr_text,
            extractedStrength: medicine.dosage,
            frequency: medicine.frequency,
            duration: medicine.duration,
            status:
                medicine.recognition_status !== "recognized" ||
                medicine.review_status === "needs_review"
                    ? "needs_review"
                    : missingInformation.length > 0
                        ? "incomplete_information"
                        : "information_extracted",
            missingInformation,
            observations
        };
    });

    return {
        prescriptionId,
        totalMedicines: medicines.length,

        reviewRequiredMedicines: medicines.filter(
            medicine => medicine.review_status === "needs_review"
        ).length,

        unrecognizedMedicines: medicines.filter(
            medicine => medicine.medicine_id === null
        ).length,

        results,
        message: "Dosage analysis checks information completeness, not clinical dosage safety."
    };
};

module.exports = {
    analyzeDosage
};