const db = require("../database/db");

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

const containsExactPhrase = (text, phrase) => {
    const normalizedText = ` ${normalize(text)} `;
    const normalizedPhrase = ` ${normalize(phrase)} `;

    return normalizedPhrase.length > 2 &&
        normalizedText.includes(normalizedPhrase);
};

const analyzeFDAInteractions = async (prescriptionId) => {

    // 1. Fetch all prescribed medicines
    const [medicines] = await db.query(
        `SELECT DISTINCT
            pm.medicine_id AS id,
            COALESCE(m.name, pm.original_ocr_name, 'Unknown medicine') AS name,
            m.generic_name,
            pm.original_ocr_name,
            pm.recognition_status,
            pm.review_status,
            pm.review_reasons
         FROM prescription_medicines pm
         LEFT JOIN medicines m ON pm.medicine_id = m.id
         WHERE pm.prescription_id = ?`,
        [prescriptionId]
    );

    const findings = [];
    const unmatchedLabelFindings = [];

    const recognizedMedicines = medicines.filter(
        medicine => medicine.id !== null
    );

    // 2. Build searchable names for every prescribed medicine
    for (const medicine of recognizedMedicines) {

        const names = [
            medicine.name,
            medicine.generic_name,
            medicine.original_ocr_name
        ].filter(Boolean);

        const [aliases] = await db.query(
            `SELECT alias_name
             FROM medicine_aliases
             WHERE medicine_id = ?`,
            [medicine.id]
        );

        const [ingredients] = await db.query(
            `SELECT ai.name
             FROM medicine_ingredients mi
             JOIN active_ingredients ai
                ON ai.id = mi.ingredient_id
             WHERE mi.medicine_id = ?`,
            [medicine.id]
        );

        medicine.matchNames = [
            ...names,
            ...aliases.map(a => a.alias_name),
            ...ingredients.map(i => i.name)
        ]
            .map(normalize)
            .filter(name => name.length >= 4);

    }

    // 3. Examine FDA findings for each recognized medicine
    for (const sourceMedicine of recognizedMedicines) {

        const [records] = await db.query(
            `SELECT
                f.id,
                f.interacting_substance,
                f.finding_type,
                f.effect_description,
                f.recommendation,
                r.source_name,
                r.source_record_id,
                r.source_url,
                r.label_effective_date
             FROM fda_interaction_findings f
             JOIN drug_label_references r
                ON f.source_reference_id = r.id
             WHERE r.medicine_id = ?
             ORDER BY f.id`,
            [sourceMedicine.id]
        );

        for (const record of records) {

            const substance = normalize(
                record.interacting_substance
            );

            const matchedMedicines = medicines.filter(medicine => {

                if (
                    medicine.id === null ||
                    medicine.id === sourceMedicine.id
                ) {
                    return false;
                }

                return (medicine.matchNames || []).some(name =>
                    containsExactPhrase(record.interacting_substance, name)
                );
            });

            // 4. Store matched findings
            if (matchedMedicines.length > 0) {

                for (const matchedMedicine of matchedMedicines) {

                    findings.push({
                        sourceMedicine: sourceMedicine.name,
                        interactingMedicine: matchedMedicine.name,
                        findingType: record.finding_type,
                        description: record.effect_description,
                        recommendation: record.recommendation,
                        source: record.source_name,
                        sourceRecordId: record.source_record_id,
                        sourceUrl: record.source_url,
                        effectiveDate: record.label_effective_date
                    });
                }

            } else {

                // 5. Preserve findings that could not be matched
                unmatchedLabelFindings.push({
                    sourceMedicine: sourceMedicine.name,
                    mentionedSubstance: record.interacting_substance,
                    findingType: record.finding_type,
                    description: record.effect_description,
                    status: "No matching prescribed medicine found"
                });
            }
        }
    }

    return {
        prescriptionId,
        totalMedicines: medicines.length,
        recognizedMedicines: recognizedMedicines.length,

        unrecognizedMedicines: medicines.filter(
            medicine => medicine.id === null
        ),

        reviewRequiredMedicines: medicines.filter(
            medicine => medicine.review_status === "needs_review"
        ),

        findings,
        unmatchedLabelFindings,
        message:
            "FDA label reference analysis completed. " +
            "These findings reflect label information, not a complete interaction assessment."
    };
};

module.exports = {
    analyzeFDAInteractions
};