const db = require("../database/db");

const analyzePrescriptionInteractions = async (prescriptionId) => {

    // =====================================================
    // STEP 1: FETCH PRESCRIBED MEDICINES
    // =====================================================

    const [medicines] = await db.query(
        `SELECT DISTINCT
            pm.medicine_id AS id,
            COALESCE(m.name, pm.original_ocr_name, 'Unknown medicine') AS name,
            pm.original_ocr_name,
            pm.recognition_status,
            pm.review_status,
            pm.review_reasons
         FROM prescription_medicines pm
         LEFT JOIN medicines m ON pm.medicine_id = m.id
         WHERE pm.prescription_id = ?`,
        [prescriptionId]
    );

    const interactions = [];
    const unassessedPairs = [];
    const duplicateIngredients = [];

    const recognizedMedicines = medicines.filter(
        medicine => medicine.id !== null
    );

    // =====================================================
    // STEP 2: FETCH ACTIVE INGREDIENTS
    // =====================================================

    const ingredientMap = new Map();

    if (recognizedMedicines.length > 0) {

        const medicineIds = recognizedMedicines.map(
            medicine => medicine.id
        );

        const [ingredientRows] = await db.query(
            `SELECT
                mi.medicine_id,
                ai.id AS ingredient_id,
                ai.name AS ingredient_name
             FROM medicine_ingredients mi
             JOIN active_ingredients ai
                ON ai.id = mi.ingredient_id
             WHERE mi.medicine_id IN (?)`,
            [medicineIds]
        );

        for (const row of ingredientRows) {

            if (!ingredientMap.has(row.medicine_id)) {
                ingredientMap.set(row.medicine_id, []);
            }

            ingredientMap.get(row.medicine_id).push({
                id: row.ingredient_id,
                name: row.ingredient_name
            });
        }
    }

    // =====================================================
    // STEP 3: GENERATE UNIQUE INGREDIENT PAIRS
    // =====================================================

    const pairMap = new Map();

    for (let i = 0; i < medicines.length; i++) {

        for (let j = i + 1; j < medicines.length; j++) {

            const medicine1 = medicines[i];
            const medicine2 = medicines[j];

            // Unrecognized medicine cannot be assessed.

            if (medicine1.id === null || medicine2.id === null) {

                unassessedPairs.push({
                    medicine1: medicine1.name,
                    medicine2: medicine2.name,
                    status: "Cannot assess because one or both medicines are unrecognized"
                });

                continue;
            }

            const ingredients1 =
                ingredientMap.get(medicine1.id) || [];

            const ingredients2 =
                ingredientMap.get(medicine2.id) || [];

            if (
                ingredients1.length === 0 ||
                ingredients2.length === 0
            ) {

                unassessedPairs.push({
                    medicine1: medicine1.name,
                    medicine2: medicine2.name,
                    status: "Cannot assess because active ingredient mapping is unavailable"
                });

                continue;
            }

            for (const ingredient1 of ingredients1) {

                for (const ingredient2 of ingredients2) {

                    // Check duplicate active ingredients.

                    if (ingredient1.id === ingredient2.id) {

                        duplicateIngredients.push({
                            medicine1: medicine1.name,
                            medicine2: medicine2.name,
                            ingredient: ingredient1.name,
                            status: "Same active ingredient appears in both prescribed medicines"
                        });

                        continue;
                    }

                    const id1 = Math.min(
                        ingredient1.id,
                        ingredient2.id
                    );

                    const id2 = Math.max(
                        ingredient1.id,
                        ingredient2.id
                    );

                    const key = `${id1}_${id2}`;

                    if (!pairMap.has(key)) {

                        pairMap.set(key, {
                            id1,
                            id2,
                            ingredient1: id1 === ingredient1.id
                                ? ingredient1.name
                                : ingredient2.name,
                            ingredient2: id2 === ingredient2.id
                                ? ingredient2.name
                                : ingredient1.name
                        });
                    }
                }
            }
        }
    }

    // =====================================================
    // STEP 4: FETCH INTERACTION EVIDENCE
    // =====================================================

    const pairKeys = Array.from(pairMap.keys());

    const interactionMap = new Map();

    for (let i = 0; i < pairKeys.length; i += 200) {

        const chunk = pairKeys.slice(i, i + 200);

        const conditions = chunk.map(
            () => "(ingredient_id_1 = ? AND ingredient_id_2 = ?)"
        );

        const values = [];

        for (const key of chunk) {

            const pair = pairMap.get(key);

            values.push(pair.id1, pair.id2);
        }

        const [records] = await db.query(
            `SELECT *
             FROM ingredient_interactions
             WHERE ${conditions.join(" OR ")}
             ORDER BY id`,
            values
        );

        for (const record of records) {

            const key =
                `${record.ingredient_id_1}_${record.ingredient_id_2}`;

            if (!interactionMap.has(key)) {
                interactionMap.set(key, []);
            }

            interactionMap.get(key).push(record);
        }
    }

    // =====================================================
    // STEP 5: ANALYZE EACH MEDICINE PAIR
    // =====================================================

    for (let i = 0; i < medicines.length; i++) {

        for (let j = i + 1; j < medicines.length; j++) {

            const medicine1 = medicines[i];
            const medicine2 = medicines[j];

            if (medicine1.id === null || medicine2.id === null) {
                continue;
            }

            const ingredients1 =
                ingredientMap.get(medicine1.id) || [];

            const ingredients2 =
                ingredientMap.get(medicine2.id) || [];

            if (
                ingredients1.length === 0 ||
                ingredients2.length === 0
            ) {
                continue;
            }

            const matchedInteractions = [];

            for (const ingredient1 of ingredients1) {

                for (const ingredient2 of ingredients2) {

                    if (ingredient1.id === ingredient2.id) {
                        continue;
                    }

                    const id1 = Math.min(
                        ingredient1.id,
                        ingredient2.id
                    );

                    const id2 = Math.max(
                        ingredient1.id,
                        ingredient2.id
                    );

                    const key = `${id1}_${id2}`;

                    const records = interactionMap.get(key) || [];

                    if (records.length === 0) {

                        unassessedPairs.push({
                            medicine1: medicine1.name,
                            medicine2: medicine2.name,
                            ingredient1: ingredient1.name,
                            ingredient2: ingredient2.name,
                            status: "No verified interaction record found; this ingredient pair remains unassessed"
                        });

                        continue;
                    }

                    for (const record of records) {

                        matchedInteractions.push({
                            ingredient1: ingredient1.name,
                            ingredient2: ingredient2.name,
                            severity: record.severity,
                            description: record.description,
                            recommendation: record.recommendation,
                            source: record.source_name,
                            sourceRecordId: record.source_record_id,
                            sourceUrl: record.source_url,
                            evidenceSummary: record.evidence_summary
                        });
                    }
                }
            }

            if (matchedInteractions.length > 0) {

                interactions.push({
                    medicine1: medicine1.name,
                    medicine2: medicine2.name,
                    ingredientInteractions: matchedInteractions
                });
            }
        }
    }

    // =====================================================
    // STEP 6: RETURN ANALYSIS
    // =====================================================

    return {

        prescriptionId,

        medicines,

        totalMedicines: medicines.length,

        recognizedMedicines: recognizedMedicines.length,

        unrecognizedMedicines: medicines.filter(
            medicine => medicine.id === null
        ),

        reviewRequiredMedicines: medicines.filter(
            medicine => medicine.review_status === "needs_review"
        ),

        totalUniqueIngredientPairsChecked: pairKeys.length,

        interactionsFound: interactions.length,

        interactions,

        duplicateIngredients,

        unassessedPairs,

        message:
            "Ingredient-level interaction analysis completed. Missing interaction records do not establish that a medicine combination is safe."
    };
};

module.exports = {
    analyzePrescriptionInteractions
};






