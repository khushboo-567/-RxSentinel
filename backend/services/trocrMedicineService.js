const db = require("../database/db");

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/\([ab]\)/gi, " ")
        .replace(/[^a-z0-9]/g, "");

const unique = (values) =>
    [...new Set(values.filter(Boolean))];

async function matchTrOCRMedicines(extractedData) {
    if (!extractedData || !Array.isArray(extractedData.entries)) {
        throw new Error("Invalid TrOCR extracted prescription data.");
    }

    const [medicines] = await db.query(
        "SELECT id, name, generic_name FROM medicines"
    );

    const [aliases] = await db.query(
        "SELECT medicine_id, alias_name, normalized_alias FROM medicine_aliases"
    );

    const results = [];

    for (const entry of extractedData.entries) {
        const fields = entry.extracted_fields || {};

        const candidates = unique(
            fields.medicine_candidates || []
        );

        const combinedCandidate = candidates.join(" + ");
        const normalizedCandidate = normalize(combinedCandidate);

        let matchedMedicine = null;
        let matchMethod = null;
        let confidence = null;

        // Build searchable catalogue information for each medicine.
        const catalogue = medicines.map(medicine => {
            const medicineAliases = aliases.filter(
                alias => String(alias.medicine_id) === String(medicine.id)
            );

            const labels = [
                medicine.name,
                medicine.generic_name,
                ...medicineAliases.flatMap(alias => [
                    alias.alias_name,
                    alias.normalized_alias
                ])
            ].filter(Boolean);

            return {
                medicine,
                labels,
                normalizedLabels: labels.map(normalize).filter(Boolean)
            };
        });

        // STEP 1: Exact catalogue match.
        if (normalizedCandidate) {
            const found = catalogue.find(item =>
                item.normalizedLabels.includes(normalizedCandidate)
            );

            if (found) {
                matchedMedicine = found.medicine;
                matchMethod = "exact_catalogue_match";
                confidence = 1.0;
            }
        }

        // STEP 2: Exact alias match.
        if (!matchedMedicine && normalizedCandidate) {
            const matchedAlias = aliases.find(alias =>
                normalize(alias.alias_name) === normalizedCandidate ||
                normalize(alias.normalized_alias) === normalizedCandidate
            );

            if (matchedAlias) {
                matchedMedicine = medicines.find(
                    medicine =>
                        String(medicine.id) === String(matchedAlias.medicine_id)
                );

                if (matchedMedicine) {
                    matchMethod = "exact_alias_match";
                    confidence = 0.98;
                }
            }
        }

        // STEP 3: Combination matching.
        // Every component must occur in the SAME catalogue medicine.
        if (!matchedMedicine && candidates.length > 1) {
            const normalizedComponents = candidates
                .map(normalize)
                .filter(Boolean);

            const found = catalogue.find(item =>
                item.normalizedLabels.some(label =>
                    normalizedComponents.every(component =>
                        label.includes(component)
                    )
                )
            );

            if (found) {
                matchedMedicine = found.medicine;
                matchMethod = "combination_component_match";
                confidence = 0.97;
            }
        }

        // STEP 4: Single-component matching only.
        if (!matchedMedicine && candidates.length === 1) {
            const candidate = normalize(candidates[0]);

            const found = catalogue.find(item =>
                item.normalizedLabels.includes(candidate)
            );

            if (found) {
                matchedMedicine = found.medicine;
                matchMethod = "exact_component_match";
                confidence = 1.0;
            }
        }

        const reviewReasons = [
            ...(entry.review_reasons || [])
        ];

        const recognitionStatus = matchedMedicine
            ? "recognized"
            : "unrecognized";

        if (!matchedMedicine) {
            reviewReasons.push(
                "Medicine could not be matched to the database"
            );
        }

        results.push({
            entryNumber: entry.entry_number,

            id: matchedMedicine ? matchedMedicine.id : null,

            name: matchedMedicine
                ? matchedMedicine.name
                : combinedCandidate || "Unknown medicine",

            originalOcrName: combinedCandidate,

            medicineCandidates: candidates,

            recognitionStatus,

            matchConfidence: confidence,

            matchMethod,

            dosage: fields.strength_candidates || [],

            frequency: fields.frequency_candidates || [],

            duration: fields.duration_candidates || [],

            originalOcrText: entry.original_ocr_text || "",

            recognitionReviewStatus: "needs_review",

            reviewReasons: unique(reviewReasons)
        });
    }

    return {
        success: true,
        totalEntries: results.length,
        recognized: results.filter(
            item => item.recognitionStatus === "recognized"
        ).length,
        unrecognized: results.filter(
            item => item.recognitionStatus === "unrecognized"
        ).length,
        entries: results
    };
}

module.exports = {
    matchTrOCRMedicines
};
