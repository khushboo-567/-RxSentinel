const db = require("../database/db");

// Helper: Normalize string for comparison
function normalize(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// =====================================================
// GET USER MEDICATIONS (BY SECTION)
// =====================================================
const getMedications = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const sectionType = req.query.section; // 'existing', 'new', or undefined for all

        let query = `
            SELECT um.*,
                   m.brand_name,
                   m.dosage_form,
                   m.standard_strength AS db_standard_strength
            FROM user_medications um
            LEFT JOIN medicines m ON um.medicine_id = m.id
            WHERE um.user_id = ?
        `;
        const params = [userId];

        if (sectionType && ["existing", "new"].includes(sectionType)) {
            query += " AND um.section_type = ?";
            params.push(sectionType);
        }

        query += " ORDER BY um.section_type ASC, um.created_at DESC";

        const [medications] = await db.query(query, params);

        // Fetch active ingredients for each medication
        for (const med of medications) {
            med.active_ingredients = [];
            if (med.medicine_id) {
                const [ings] = await db.query(`
                    SELECT ai.id, ai.name, ai.normalized_name, ai.max_daily_dose_mg, mi.ingredient_strength, mi.strength_mg
                    FROM medicine_ingredients mi
                    JOIN active_ingredients ai ON ai.id = mi.ingredient_id
                    WHERE mi.medicine_id = ?
                `, [med.medicine_id]);
                med.active_ingredients = ings;
            } else {
                // Try to resolve directly by name or alias
                const normName = normalize(med.medicine_name);
                const [directIng] = await db.query(`
                    SELECT id, name, normalized_name, max_daily_dose_mg
                    FROM active_ingredients
                    WHERE normalized_name = ?
                `, [normName]);
                if (directIng.length > 0) {
                    med.active_ingredients = directIng;
                }
            }
        }

        res.json({
            success: true,
            medications,
            count: medications.length
        });
    } catch (error) {
        console.error("Get Medications Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve medications: " + error.message
        });
    }
};

// =====================================================
// SEARCH MEDICINES IN DATABASE (EXACT, NORMALIZED, ALIAS)
// =====================================================
const searchMedicines = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        if (!q || q.length < 2) {
            return res.json({ success: true, results: [] });
        }

        const normQuery = normalize(q);

        // 1. Search in medicines and medicine_aliases
        const [medRows] = await db.query(`
            SELECT DISTINCT
                m.id,
                m.name,
                m.brand_name,
                m.generic_name,
                m.dosage_form,
                m.standard_strength,
                ma.alias_name,
                ma.alias_type
            FROM medicines m
            LEFT JOIN medicine_aliases ma ON ma.medicine_id = m.id
            WHERE m.name LIKE ? 
               OR m.generic_name LIKE ?
               OR m.brand_name LIKE ?
               OR ma.alias_name LIKE ?
               OR ma.normalized_alias LIKE ?
            LIMIT 25
        `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${normQuery}%`]);

        // 2. Also search active_ingredients directly
        const [ingRows] = await db.query(`
            SELECT id, name, normalized_name, max_daily_dose_mg, description
            FROM active_ingredients
            WHERE name LIKE ? OR normalized_name LIKE ?
            LIMIT 15
        `, [`%${q}%`, `%${normQuery}%`]);

        // Map and rank results
        const resultMap = new Map();

        for (const row of medRows) {
            if (!resultMap.has(row.id)) {
                // Fetch ingredients for this medicine
                const [ings] = await db.query(`
                    SELECT ai.id, ai.name, ai.normalized_name, ai.max_daily_dose_mg, mi.ingredient_strength, mi.strength_mg
                    FROM medicine_ingredients mi
                    JOIN active_ingredients ai ON ai.id = mi.ingredient_id
                    WHERE mi.medicine_id = ?
                `, [row.id]);

                // Determine match confidence
                let matchType = "partial";
                let confidence = 75;
                if (normalize(row.name) === normQuery || normalize(row.brand_name || "") === normQuery) {
                    matchType = "exact";
                    confidence = 100;
                } else if (normalize(row.generic_name || "") === normQuery || (row.alias_name && normalize(row.alias_name) === normQuery)) {
                    matchType = "alias_exact";
                    confidence = 95;
                }

                resultMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    brand_name: row.brand_name,
                    generic_name: row.generic_name || row.name,
                    dosage_form: row.dosage_form,
                    standard_strength: row.standard_strength,
                    matched_alias: row.alias_name || null,
                    matchType,
                    confidence,
                    active_ingredients: ings
                });
            }
        }

        // Add standalone active ingredients if not already in results
        for (const ing of ingRows) {
            const tempId = `ing_${ing.id}`;
            const isExact = ing.normalized_name === normQuery;
            resultMap.set(tempId, {
                id: null,
                ingredient_id: ing.id,
                name: ing.name,
                brand_name: null,
                generic_name: ing.name,
                dosage_form: "Substance/Ingredient",
                standard_strength: null,
                matchType: isExact ? "exact_ingredient" : "ingredient",
                confidence: isExact ? 98 : 80,
                active_ingredients: [ing]
            });
        }

        const results = Array.from(resultMap.values()).sort((a, b) => b.confidence - a.confidence);

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error("Search Medicines Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search medicines: " + error.message
        });
    }
};

// =====================================================
// ADD MEDICATION MANUALLY
// =====================================================
const addMedication = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const {
            section_type,
            medicine_name,
            generic_name,
            strength,
            dosage,
            frequency,
            duration,
            source = "manual",
            prescription_id = null,
            notes = null
        } = req.body;

        if (!medicine_name || !medicine_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Medicine name is required"
            });
        }

        if (!section_type || !["existing", "new"].includes(section_type)) {
            return res.status(400).json({
                success: false,
                message: "Valid section_type ('existing' or 'new') is required"
            });
        }

        const cleanMedName = medicine_name.trim();
        const normName = normalize(cleanMedName);

        // Attempt to match against database
        let matchedMedId = null;
        let resolvedGeneric = generic_name ? generic_name.trim() : null;

        // 1. Check exact medicine name
        const [exactMed] = await db.query(
            "SELECT id, generic_name, standard_strength FROM medicines WHERE name = ? OR LOWER(name) = LOWER(?)",
            [cleanMedName, cleanMedName]
        );

        if (exactMed.length > 0) {
            matchedMedId = exactMed[0].id;
            if (!resolvedGeneric) resolvedGeneric = exactMed[0].generic_name;
        } else {
            // 2. Check alias
            const [aliasMed] = await db.query(`
                SELECT m.id, m.name, m.generic_name
                FROM medicine_aliases ma
                JOIN medicines m ON ma.medicine_id = m.id
                WHERE ma.normalized_alias = ?
            `, [normName]);

            if (aliasMed.length > 0) {
                matchedMedId = aliasMed[0].id;
                if (!resolvedGeneric) resolvedGeneric = aliasMed[0].generic_name || aliasMed[0].name;
            }
        }

        const [insertResult] = await db.query(`
            INSERT INTO user_medications
            (user_id, section_type, medicine_id, medicine_name, generic_name, strength, dosage, frequency, duration, source, prescription_id, is_confirmed, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
            userId,
            section_type,
            matchedMedId,
            cleanMedName,
            resolvedGeneric,
            strength ? strength.trim() : null,
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            duration ? duration.trim() : null,
            source,
            prescription_id,
            notes
        ]);

        res.status(201).json({
            success: true,
            message: "Medication added successfully",
            medicationId: insertResult.insertId,
            matched: Boolean(matchedMedId)
        });
    } catch (error) {
        console.error("Add Medication Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add medication: " + error.message
        });
    }
};

// =====================================================
// UPDATE MEDICATION
// =====================================================
const updateMedication = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const medId = Number(req.params.id);

        const {
            medicine_name,
            generic_name,
            strength,
            dosage,
            frequency,
            duration,
            section_type,
            notes
        } = req.body;

        const [existing] = await db.query(
            "SELECT id FROM user_medications WHERE id = ? AND user_id = ?",
            [medId, userId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medication not found"
            });
        }

        // Re-check medicine matching if name changed
        let matchedMedId = null;
        let resolvedGeneric = generic_name || null;
        if (medicine_name) {
            const cleanName = medicine_name.trim();
            const normName = normalize(cleanName);
            const [exactMed] = await db.query(
                "SELECT id, generic_name FROM medicines WHERE name = ? OR LOWER(name) = LOWER(?)",
                [cleanName, cleanName]
            );
            if (exactMed.length > 0) {
                matchedMedId = exactMed[0].id;
                if (!resolvedGeneric) resolvedGeneric = exactMed[0].generic_name;
            } else {
                const [aliasMed] = await db.query(`
                    SELECT m.id, m.generic_name FROM medicine_aliases ma
                    JOIN medicines m ON ma.medicine_id = m.id WHERE ma.normalized_alias = ?
                `, [normName]);
                if (aliasMed.length > 0) {
                    matchedMedId = aliasMed[0].id;
                    if (!resolvedGeneric) resolvedGeneric = aliasMed[0].generic_name;
                }
            }
        }

        await db.query(`
            UPDATE user_medications
            SET medicine_name = COALESCE(?, medicine_name),
                generic_name = COALESCE(?, generic_name),
                strength = COALESCE(?, strength),
                dosage = COALESCE(?, dosage),
                frequency = COALESCE(?, frequency),
                duration = COALESCE(?, duration),
                section_type = COALESCE(?, section_type),
                medicine_id = COALESCE(?, medicine_id),
                notes = COALESCE(?, notes)
            WHERE id = ? AND user_id = ?
        `, [
            medicine_name ? medicine_name.trim() : null,
            resolvedGeneric,
            strength ? strength.trim() : null,
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            duration ? duration.trim() : null,
            section_type || null,
            matchedMedId,
            notes,
            medId,
            userId
        ]);

        res.json({
            success: true,
            message: "Medication updated successfully"
        });
    } catch (error) {
        console.error("Update Medication Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update medication: " + error.message
        });
    }
};

// =====================================================
// DELETE MEDICATION
// =====================================================
const deleteMedication = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const medId = Number(req.params.id);

        const [result] = await db.query(
            "DELETE FROM user_medications WHERE id = ? AND user_id = ?",
            [medId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Medication not found"
            });
        }

        res.json({
            success: true,
            message: "Medication removed successfully"
        });
    } catch (error) {
        console.error("Delete Medication Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete medication: " + error.message
        });
    }
};

// =====================================================
// BATCH CONFIRM MEDICINES FROM OCR INTO SECTION
// =====================================================
const batchConfirmMedications = async (req, res) => {
    let connection;
    try {
        const userId = req.user.userId || req.user.id;
        const { section_type, medications, prescription_id } = req.body;

        if (!section_type || !["existing", "new"].includes(section_type)) {
            return res.status(400).json({
                success: false,
                message: "Valid section_type ('existing' or 'new') is required"
            });
        }

        if (!Array.isArray(medications) || medications.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Medications array cannot be empty"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        let insertedCount = 0;

        for (const item of medications) {
            const medName = item.medicine_name || item.originalOcrName || item.name;
            if (!medName || !medName.trim()) continue;

            const cleanName = medName.trim();
            const normName = normalize(cleanName);

            let medId = item.id || item.medicine_id || null;
            let generic = item.generic_name || null;

            if (!medId) {
                const [exact] = await connection.query(
                    "SELECT id, generic_name FROM medicines WHERE name = ? OR LOWER(name) = LOWER(?)",
                    [cleanName, cleanName]
                );
                if (exact.length > 0) {
                    medId = exact[0].id;
                    if (!generic) generic = exact[0].generic_name;
                } else {
                    const [alias] = await connection.query(`
                        SELECT m.id, m.generic_name FROM medicine_aliases ma
                        JOIN medicines m ON ma.medicine_id = m.id WHERE ma.normalized_alias = ?
                    `, [normName]);
                    if (alias.length > 0) {
                        medId = alias[0].id;
                        if (!generic) generic = alias[0].generic_name;
                    }
                }
            }

            await connection.query(`
                INSERT INTO user_medications
                (user_id, section_type, medicine_id, medicine_name, generic_name, strength, dosage, frequency, duration, source, prescription_id, is_confirmed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ocr', ?, 1)
            `, [
                userId,
                section_type,
                medId,
                cleanName,
                generic,
                item.strength || null,
                item.dosage || null,
                item.frequency || null,
                item.duration || null,
                prescription_id || null
            ]);
            insertedCount++;
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Successfully confirmed and added ${insertedCount} medications to ${section_type === 'existing' ? 'Previous/Current Medications (Section A)' : 'New Medications (Section B)'}.`,
            insertedCount
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Batch Confirm Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to batch confirm medications: " + error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// =====================================================
// CLEAR SECTION
// =====================================================
const clearSection = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const sectionType = req.params.section;

        if (!["existing", "new"].includes(sectionType)) {
            return res.status(400).json({
                success: false,
                message: "Valid section ('existing' or 'new') is required"
            });
        }

        const [result] = await db.query(
            "DELETE FROM user_medications WHERE user_id = ? AND section_type = ?",
            [userId, sectionType]
        );

        res.json({
            success: true,
            message: `Cleared ${result.affectedRows} medications from ${sectionType === 'existing' ? 'Section A (Previous/Current)' : 'Section B (New)'}`
        });
    } catch (error) {
        console.error("Clear Section Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear section: " + error.message
        });
    }
};

module.exports = {
    getMedications,
    searchMedicines,
    addMedication,
    updateMedication,
    deleteMedication,
    batchConfirmMedications,
    clearSection
};
