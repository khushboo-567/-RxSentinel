const db = require("../database/db");

// Helper: Normalize string
function normalize(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Helper: Parse strength into milligrams (mg)
function parseStrengthMg(strengthStr) {
    if (!strengthStr) return null;
    const s = String(strengthStr).toLowerCase();
    
    // Look for mg
    const mgMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*mg/);
    if (mgMatch) return parseFloat(mgMatch[1]);

    // Look for g / grams
    const gMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*g(?:ram)?s?/);
    if (gMatch && !s.includes("mg")) return parseFloat(gMatch[1]) * 1000;

    // Look for mcg / ug
    const mcgMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:mcg|ug)/);
    if (mcgMatch) return parseFloat(mcgMatch[1]) / 1000;

    // Pure number
    const numMatch = s.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (numMatch) return parseFloat(numMatch[1]);

    return null;
}

// Helper: Parse daily frequency multiplier
function parseFrequencyMultiplier(freqStr) {
    if (!freqStr) return null;
    const f = String(freqStr).toLowerCase();

    if (f.includes("once") || f.includes("od") || f.includes("qday") || f.includes("daily") || f.includes("1 time") || f.includes("1x")) return 1;
    if (f.includes("twice") || f.includes("bid") || f.includes("bd") || f.includes("2 times") || f.includes("2x") || f.includes("every 12")) return 2;
    if (f.includes("thrice") || f.includes("tid") || f.includes("tds") || f.includes("3 times") || f.includes("3x") || f.includes("every 8")) return 3;
    if (f.includes("four") || f.includes("qid") || f.includes("4 times") || f.includes("4x") || f.includes("every 6")) return 4;
    if (f.includes("every 4")) return 6;
    if (f.includes("prn") || f.includes("as needed")) return 1;

    return null;
}

/**
 * Core Safety Analysis Engine
 * @param {number} userId
 * @param {object} options
 */
async function runSafetyAnalysis(userId, options = {}) {
    // =====================================================
    // STEP 1: RETRIEVE USER MEDICATIONS (SECTIONS A & B)
    // =====================================================
    const [existingMeds] = await db.query(`
        SELECT um.*, m.name as db_med_name, m.generic_name as db_generic_name, m.standard_strength as db_strength
        FROM user_medications um
        LEFT JOIN medicines m ON um.medicine_id = m.id
        WHERE um.user_id = ? AND um.section_type = 'existing' AND um.is_confirmed = 1
    `, [userId]);

    const [newMeds] = await db.query(`
        SELECT um.*, m.name as db_med_name, m.generic_name as db_generic_name, m.standard_strength as db_strength
        FROM user_medications um
        LEFT JOIN medicines m ON um.medicine_id = m.id
        WHERE um.user_id = ? AND um.section_type = 'new' AND um.is_confirmed = 1
    `, [userId]);

    // Retrieve user allergies
    const [userAllergies] = await db.query(`
        SELECT * FROM user_allergies WHERE user_id = ?
    `, [userId]);

    const allMeds = [
        ...existingMeds.map(m => ({ ...m, section: "existing" })),
        ...newMeds.map(m => ({ ...m, section: "new" }))
    ];

    // =====================================================
    // STEP 2: RESOLVE ACTIVE INGREDIENTS
    // =====================================================
    const resolvedMedicines = [];
    const unrecognizedMedicines = [];

    for (const med of allMeds) {
        let ingredients = [];
        let matchedMedicineId = med.medicine_id;

        // If med has medicine_id, fetch from medicine_ingredients
        if (matchedMedicineId) {
            const [ingRows] = await db.query(`
                SELECT ai.id, ai.name, ai.normalized_name, ai.max_daily_dose_mg, mi.ingredient_strength, mi.strength_mg
                FROM medicine_ingredients mi
                JOIN active_ingredients ai ON ai.id = mi.ingredient_id
                WHERE mi.medicine_id = ?
            `, [matchedMedicineId]);
            ingredients = ingRows;
        }

        // If not matched or no ingredients found, try alias or exact name search
        if (ingredients.length === 0) {
            const cleanName = med.medicine_name.trim();
            const normName = normalize(cleanName);

            // Check exact medicine
            const [exactMed] = await db.query(
                "SELECT id FROM medicines WHERE name = ? OR LOWER(name) = LOWER(?)",
                [cleanName, cleanName]
            );

            if (exactMed.length > 0) {
                matchedMedicineId = exactMed[0].id;
                const [ingRows] = await db.query(`
                    SELECT ai.id, ai.name, ai.normalized_name, ai.max_daily_dose_mg, mi.ingredient_strength, mi.strength_mg
                    FROM medicine_ingredients mi
                    JOIN active_ingredients ai ON ai.id = mi.ingredient_id
                    WHERE mi.medicine_id = ?
                `, [matchedMedicineId]);
                ingredients = ingRows;
            } else {
                // Check alias
                const [aliasMed] = await db.query(`
                    SELECT m.id FROM medicine_aliases ma
                    JOIN medicines m ON ma.medicine_id = m.id
                    WHERE ma.normalized_alias = ?
                `, [normName]);

                if (aliasMed.length > 0) {
                    matchedMedicineId = aliasMed[0].id;
                    const [ingRows] = await db.query(`
                        SELECT ai.id, ai.name, ai.normalized_name, ai.max_daily_dose_mg, mi.ingredient_strength, mi.strength_mg
                        FROM medicine_ingredients mi
                        JOIN active_ingredients ai ON ai.id = mi.ingredient_id
                        WHERE mi.medicine_id = ?
                    `, [matchedMedicineId]);
                    ingredients = ingRows;
                } else {
                    // Check active_ingredients directly
                    const [directIng] = await db.query(
                        "SELECT id, name, normalized_name, max_daily_dose_mg FROM active_ingredients WHERE normalized_name = ?",
                        [normName]
                    );
                    if (directIng.length > 0) {
                        ingredients = directIng.map(i => ({ ...i, strength_mg: null }));
                    }
                }
            }
        }

        if (ingredients.length > 0) {
            resolvedMedicines.push({
                ...med,
                resolved_medicine_id: matchedMedicineId,
                ingredients
            });
        } else {
            unrecognizedMedicines.push({
                ...med,
                status: "Unrecognized medicine - active ingredients could not be verified in the medical database"
            });
        }
    }

    // =====================================================
    // STEP 3: DRUG-DRUG INTERACTION CHECKING
    // (Existing vs New, Existing vs Existing, New vs New)
    // =====================================================
    const interactionFindings = [];
    const checkedPairs = new Set();
    const unassessedPairs = [];

    // Also collect all unique ingredients per medicine for pair comparison
    for (let i = 0; i < resolvedMedicines.length; i++) {
        for (let j = i + 1; j < resolvedMedicines.length; j++) {
            const medA = resolvedMedicines[i];
            const medB = resolvedMedicines[j];

            const pairContext = (medA.section === medB.section)
                ? (medA.section === "existing" ? "Between Existing Medications" : "Between New Medications")
                : "Between Existing and New Medication";

            for (const ingA of medA.ingredients) {
                for (const ingB of medB.ingredients) {
                    if (ingA.id === ingB.id) continue; // Duplicate ingredient handled separately

                    const id1 = Math.min(ingA.id, ingB.id);
                    const id2 = Math.max(ingA.id, ingB.id);
                    const pairKey = `${id1}_${id2}`;

                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);

                    // Query drug_interactions table
                    const [interactions] = await db.query(`
                        SELECT * FROM drug_interactions
                        WHERE ingredient_id_1 = ? AND ingredient_id_2 = ?
                    `, [id1, id2]);

                    if (interactions.length > 0) {
                        const inter = interactions[0];
                        interactionFindings.push({
                            finding_type: "drug_interaction",
                            severity: inter.severity,
                            medicine_1_name: medA.medicine_name,
                            medicine_2_name: medB.medicine_name,
                            ingredient_1_name: ingA.name,
                            ingredient_2_name: ingB.name,
                            pair_context: pairContext,
                            title: inter.title || `Interaction: ${ingA.name} + ${ingB.name}`,
                            description: inter.description,
                            clinical_implication: inter.clinical_effect || null,
                            mechanism: inter.mechanism || null,
                            recommendation: inter.recommendation,
                            evidence_source: inter.source_name || "FDA / Lexicomp Clinical Safety Database",
                            source_url: inter.source_url || null
                        });
                    } else {
                        unassessedPairs.push({
                            medA: medA.medicine_name,
                            medB: medB.medicine_name,
                            ingA: ingA.name,
                            ingB: ingB.name,
                            pair_context: pairContext,
                            status: "No documented interaction found in current verified database. Note: this does not guarantee clinical compatibility."
                        });
                    }
                }
            }
        }
    }

    // =====================================================
    // STEP 4: ALLERGY CHECKING
    // =====================================================
    const allergyFindings = [];

    // Allergy cross-reactivity mapping for clinical drug classes
    const allergyClassMap = {
        penicillin: ["amoxicillin", "ampicillin", "augmentin", "penicillin", "piperacillin", "clavulanicacid"],
        amoxicillin: ["amoxicillin", "augmentin", "penicillin"],
        sulfa: ["sulphamethoxazole", "sulfamethoxazole", "trimethoprim", "bactrim", "septra", "sulfadiazine"],
        sulfonamide: ["sulphamethoxazole", "sulfamethoxazole", "trimethoprim", "bactrim", "septra"],
        aspirin: ["aspirin", "ibuprofen", "naproxen", "diclofenac", "ketorolac", "indomethacin"],
        nsaid: ["aspirin", "ibuprofen", "naproxen", "diclofenac", "meloxicam", "celecoxib"],
        ibuprofen: ["ibuprofen", "aspirin", "naproxen", "combiflam"],
        codeine: ["codeine", "tramadol", "morphine"],
        tramadol: ["tramadol", "codeine"],
        ciprofloxacin: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "norfloxacin"],
        fluoroquinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"]
    };

    for (const allergy of userAllergies) {
        const normAllergen = normalize(allergy.allergen_name);

        for (const med of allMeds) {
            let conflictFound = false;
            let conflictReason = "";

            const normMedName = normalize(med.medicine_name);
            const normGeneric = normalize(med.generic_name || "");

            // Direct name match
            if (normMedName.includes(normAllergen) || normAllergen.includes(normMedName)) {
                conflictFound = true;
                conflictReason = `Direct match between reported allergy '${allergy.allergen_name}' and medicine '${med.medicine_name}'`;
            } else if (normGeneric && (normGeneric.includes(normAllergen) || normAllergen.includes(normGeneric))) {
                conflictFound = true;
                conflictReason = `Direct match between reported allergy '${allergy.allergen_name}' and generic active substance '${med.generic_name}'`;
            }

            // Ingredient match
            const resolved = resolvedMedicines.find(rm => rm.id === med.id);
            if (!conflictFound && resolved) {
                for (const ing of resolved.ingredients) {
                    const normIng = normalize(ing.name);
                    if (normIng.includes(normAllergen) || normAllergen.includes(normIng)) {
                        conflictFound = true;
                        conflictReason = `Medicine '${med.medicine_name}' contains active ingredient '${ing.name}', which matches your reported allergen '${allergy.allergen_name}'`;
                        break;
                    }

                    // Check cross-reactivity classes
                    for (const [allergyGroup, groupMembers] of Object.entries(allergyClassMap)) {
                        if (normAllergen.includes(allergyGroup)) {
                            if (groupMembers.some(m => normIng.includes(m) || normMedName.includes(m))) {
                                conflictFound = true;
                                conflictReason = `High cross-reactivity risk: '${allergy.allergen_name}' belongs to the ${allergyGroup.toUpperCase()} drug class, which cross-reacts with active ingredient '${ing.name}' in '${med.medicine_name}'`;
                                break;
                            }
                        }
                    }
                    if (conflictFound) break;
                }
            }

            if (conflictFound) {
                const assignedSeverity = allergy.severity === "severe" ? "major" : (allergy.severity === "moderate" ? "moderate" : "minor");
                allergyFindings.push({
                    finding_type: "allergy_conflict",
                    severity: assignedSeverity,
                    medicine_1_name: med.medicine_name,
                    ingredient_1_name: allergy.allergen_name,
                    title: `Allergy Conflict: ${med.medicine_name} (${allergy.allergen_name})`,
                    description: conflictReason,
                    clinical_implication: allergy.reaction ? `Documented patient reaction: ${allergy.reaction}. Risk of severe hypersensitivity.` : "Risk of acute hypersensitivity / allergic reaction.",
                    recommendation: `DO NOT ADMINISTER without consulting an allergist or physician. Immediate substitution with a non-cross-reactive alternative is strongly advised.`,
                    evidence_source: "Patient Reported Allergy Profile / Clinical Cross-Reactivity Database"
                });
            }
        }
    }

    // =====================================================
    // STEP 5: DUPLICATE ACTIVE INGREDIENT DETECTION
    // =====================================================
    const duplicateFindings = [];
    const ingredientMedMap = new Map();

    for (const med of resolvedMedicines) {
        for (const ing of med.ingredients) {
            const ingKey = ing.normalized_name;
            if (!ingredientMedMap.has(ingKey)) {
                ingredientMedMap.set(ingKey, []);
            }
            ingredientMedMap.get(ingKey).push({
                medName: med.medicine_name,
                section: med.section,
                strength: med.strength || ing.ingredient_strength || "Unspecified strength"
            });
        }
    }

    for (const [ingKey, medsList] of ingredientMedMap.entries()) {
        if (medsList.length > 1) {
            const ingName = medsList[0].medName;
            const medNames = medsList.map(m => `${m.medName} (${m.section === "existing" ? "Section A: Existing" : "Section B: New"})`).join(" and ");
            duplicateFindings.push({
                finding_type: "duplicate_ingredient",
                severity: "moderate",
                medicine_1_name: medsList[0].medName,
                medicine_2_name: medsList[1].medName,
                ingredient_1_name: ingKey,
                title: `Duplicate Ingredient Exposure: ${ingKey.toUpperCase()}`,
                description: `Multiple prescribed medicines contain the identical active substance: ${medNames}.`,
                clinical_implication: "Concurrent intake of separate brand products containing the same active ingredient can result in unintentional cumulative overdose, organ toxicity, and amplified adverse effects.",
                recommendation: "Review with doctor or pharmacist to discontinue duplicate formulations and ensure total daily dosage remains within validated safe limits.",
                evidence_source: "FDA Safety Alert on Duplicate Ingredient Exposure"
            });
        }
    }

    // =====================================================
    // STEP 6: DOSAGE CHECKING & VALIDATION
    // =====================================================
    const dosageFindings = [];
    const ingredientCumulativeDose = new Map();

    for (const med of resolvedMedicines) {
        const mult = parseFrequencyMultiplier(med.frequency);
        const strengthVal = parseStrengthMg(med.strength);

        for (const ing of med.ingredients) {
            const ingMaxDose = ing.max_daily_dose_mg;
            const ingKey = ing.normalized_name;

            let unitDose = strengthVal || ing.strength_mg || parseStrengthMg(ing.ingredient_strength);

            if (!mult || !unitDose) {
                // Incomplete dosage information
                dosageFindings.push({
                    finding_type: "dosage_warning",
                    severity: "unknown",
                    medicine_1_name: med.medicine_name,
                    ingredient_1_name: ing.name,
                    title: `Incomplete Dosage Data: ${med.medicine_name}`,
                    description: `Cannot comprehensively evaluate dosage safety: ${!unitDose ? "strength/dose" : "frequency"} is missing or unverified.`,
                    clinical_implication: "Insufficient clinical parameters to verify whether cumulative dosage conforms to safe therapeutic guidelines.",
                    recommendation: `Confirm exact dosage strength (mg) and daily frequency with the prescribing doctor.`,
                    evidence_source: "Clinical Pharmacotherapy Threshold Verification"
                });
            } else {
                const dailyDose = unitDose * mult;
                if (!ingredientCumulativeDose.has(ingKey)) {
                    ingredientCumulativeDose.set(ingKey, {
                        name: ing.name,
                        maxDose: ingMaxDose,
                        cumulativeDailyDose: 0,
                        medicines: []
                    });
                }
                const entry = ingredientCumulativeDose.get(ingKey);
                entry.cumulativeDailyDose += dailyDose;
                entry.medicines.push(`${med.medicine_name} (${unitDose}mg x ${mult}/day = ${dailyDose}mg/day)`);
            }
        }
    }

    // Check cumulative daily doses against maximum validated limits
    for (const [ingKey, data] of ingredientCumulativeDose.entries()) {
        if (data.maxDose && data.cumulativeDailyDose > data.maxDose) {
            dosageFindings.push({
                finding_type: "dosage_warning",
                severity: "major",
                ingredient_1_name: data.name,
                title: `Maximum Daily Dose Exceeded: ${data.name}`,
                description: `Calculated cumulative daily intake of ${data.name} is ${data.cumulativeDailyDose} mg/day across: ${data.medicines.join(", ")}, which exceeds the maximum validated clinical ceiling of ${data.maxDose} mg/day.`,
                clinical_implication: `High risk of acute ingredient toxicity, metabolic overload, organ injury (e.g. hepatotoxicity or nephrotoxicity), and severe adverse drug reactions.`,
                recommendation: `URGENT: Reduce dosage or consult prescribing physician before consuming this combination.`,
                evidence_source: "FDA Daily Maximum Prescribing Limits / Pharmacotherapy Reference"
            });
        }
    }

    // Unrecognized medicines findings
    const unrecognizedFindings = unrecognizedMedicines.map(med => ({
        finding_type: "unrecognized_medicine",
        severity: "unknown",
        medicine_1_name: med.medicine_name,
        title: `Unrecognized Medicine: ${med.medicine_name}`,
        description: `This medicine could not be matched with high confidence to validated active ingredients in our pharmaceutical database. Interaction analysis could NOT be conducted for this drug.`,
        clinical_implication: "Potential interactions, allergy conflicts, and duplicate exposures for this item remain unassessed.",
        recommendation: "Manually verify the generic name or active substance with your pharmacist and update your medication list.",
        evidence_source: "RxSentinel Database Matching Verification"
    }));

    // =====================================================
    // STEP 7: COMPILE ALL FINDINGS & COMPUTE STATUS
    // =====================================================
    const allFindings = [
        ...interactionFindings,
        ...allergyFindings,
        ...duplicateFindings,
        ...dosageFindings,
        ...unrecognizedFindings
    ];

    const majorCount = allFindings.filter(f => f.severity === "major").length;
    const moderateCount = allFindings.filter(f => f.severity === "moderate").length;
    const minorCount = allFindings.filter(f => f.severity === "minor").length;
    const unknownCount = allFindings.filter(f => f.severity === "unknown").length;

    let summaryStatus = "safe";
    if (majorCount > 0) {
        summaryStatus = "major_danger";
    } else if (moderateCount > 0 || duplicateFindings.length > 0) {
        summaryStatus = "moderate_warning";
    } else if (unknownCount > 0 || unrecognizedMedicines.length > 0) {
        summaryStatus = "unassessed_info";
    }

    // Prepare complete raw snapshot
    const rawSnapshot = {
        generatedAt: new Date().toISOString(),
        summaryStatus,
        counts: {
            majorCount,
            moderateCount,
            minorCount,
            unknownCount,
            duplicateCount: duplicateFindings.length,
            allergyConflictCount: allergyFindings.length,
            dosageWarningCount: dosageFindings.length,
            unrecognizedCount: unrecognizedMedicines.length
        },
        existingMedications: existingMeds,
        newMedications: newMeds,
        resolvedMedicines,
        unrecognizedMedicines,
        findings: allFindings,
        unassessedPairs,
        disclaimer: "RxSentinel provides clinical decision support and drug safety alerts based on validated medical literature. A green indicator denotes that no documented interaction was identified in the available database; it does NOT constitute proof that a medicine combination is clinically safe. Always consult a licensed doctor or pharmacist before making any changes to your medication regimen."
    };

    // =====================================================
    // STEP 8: PERSIST TO DATABASE
    // (analysis_reports and analysis_findings)
    // =====================================================
    const [reportResult] = await db.query(`
        INSERT INTO analysis_reports
        (user_id, report_title, summary_status, total_existing_meds, total_new_meds, major_count, moderate_count, minor_count, unassessed_count, duplicate_count, allergy_conflict_count, dosage_warning_count, raw_snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        userId,
        options.title || `Medication Safety Report – ${new Date().toLocaleDateString()}`,
        summaryStatus,
        existingMeds.length,
        newMeds.length,
        majorCount,
        moderateCount,
        minorCount,
        unknownCount,
        duplicateFindings.length,
        allergyFindings.length,
        dosageFindings.length,
        JSON.stringify(rawSnapshot)
    ]);

    const reportId = reportResult.insertId;

    // Save individual findings
    for (const finding of allFindings) {
        await db.query(`
            INSERT INTO analysis_findings
            (report_id, finding_type, severity, medicine_1_name, medicine_2_name, ingredient_1_name, ingredient_2_name, title, description, clinical_implication, recommendation, evidence_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            reportId,
            finding.finding_type,
            finding.severity,
            finding.medicine_1_name || null,
            finding.medicine_2_name || null,
            finding.ingredient_1_name || null,
            finding.ingredient_2_name || null,
            finding.title,
            finding.description,
            finding.clinical_implication || null,
            finding.recommendation,
            finding.evidence_source || null
        ]);
    }

    return {
        reportId,
        reportTitle: options.title || `Medication Safety Report – ${new Date().toLocaleDateString()}`,
        summaryStatus,
        counts: rawSnapshot.counts,
        existingMedications: existingMeds,
        newMedications: newMeds,
        resolvedMedicines,
        unrecognizedMedicines,
        findings: allFindings,
        unassessedPairs,
        disclaimer: rawSnapshot.disclaimer
    };
}

module.exports = {
    runSafetyAnalysis,
    parseStrengthMg,
    parseFrequencyMultiplier
};
