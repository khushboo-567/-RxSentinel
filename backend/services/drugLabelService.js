const axios = require("axios");
const db = require("../database/db");

const searchDrugLabel = async (medicineName) => {
    try {
        const response = await axios.get(
            "https://api.fda.gov/drug/label.json",
            {
                params: {
                    search: `_exists_:drug_interactions AND openfda.generic_name:"${medicineName}"`,
                    limit: 10
                },
                timeout: 20000
            }
        );

        return response.data.results || [];

    } catch (error) {
        if (error.response?.status === 404) {
            return [];
        }

        console.error("FDA Label API Error:", error.message);
        throw new Error("Unable to retrieve FDA drug label data");
    }
};

const saveDrugLabelReferences = async (medicineId, medicineName) => {

    const records = await searchDrugLabel(medicineName);

    let savedCount = 0;

    for (const record of records) {

        const sourceRecordId = record.set_id || record.id;

        if (!sourceRecordId) continue;

        const interactionText =
            record.drug_interactions?.join("\n") || "";

        if (!interactionText.trim()) continue;

        const sourceUrl =
            `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(
                `_exists_:drug_interactions AND openfda.generic_name:"${medicineName}"`
            )}`;

        await db.query(
            `INSERT INTO drug_label_references
            (
                medicine_id,
                source_name,
                source_record_id,
                product_name,
                interaction_text,
                source_url,
                label_effective_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                interaction_text = VALUES(interaction_text),
                product_name = VALUES(product_name),
                source_url = VALUES(source_url),
                label_effective_date = VALUES(label_effective_date),
                retrieved_at = CURRENT_TIMESTAMP`,
            [
                medicineId,
                "openFDA",
                sourceRecordId,
                record.openfda?.brand_name?.[0] || medicineName,
                interactionText,
                sourceUrl,
                record.effective_time || null
            ]
        );

        savedCount++;
    }

    return {
        medicine: medicineName,
        recordsFound: records.length,
        recordsSaved: savedCount
    };
};

module.exports = {
    searchDrugLabel,
    saveDrugLabelReferences
};