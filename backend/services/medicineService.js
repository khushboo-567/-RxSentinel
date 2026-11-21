const db = require("../database/db");

// =====================================================
// NORMALIZATION
// =====================================================

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const normalizeOCRMedicineName = (value) => {
    let name = String(value || "").trim();

    name = name.replace(/^[Tt](?=buprofen)/, "I");
    name = name.replace(/^[l|](?=buprofen)/, "I");

    return name;
};

// =====================================================
// STOP SECTIONS
// =====================================================

const stopPattern =
    /important notes|additional instructions|doctor.?s signature|disclaimer|precautions|warning|consult your doctor/i;

const cleanSection = (value) => {
    const text = String(value || "");
    const stopIndex = text.search(stopPattern);

    return stopIndex >= 0
        ? text.substring(0, stopIndex).trim()
        : text.trim();
};

// =====================================================
// PRESCRIPTION ROW EXTRACTION
// =====================================================

const dosageRegex =
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|μg|g|ml|iu|units?|%|tablets?|capsules?)\b/i;

const frequencyRegex =
    /\b(?:four\s+times\s+daily|thrice\s+daily|twice\s+daily|once\s+daily|once\s+nightly|twice\s+weekly|once|twice|thrice|daily|weekly|monthly|every\s+\d+\s+hours?|morning|night|bedtime|as\s+needed|when\s+required|bid|tid|qid|od|bd|tds|qds|prn)\b/i;

const durationRegex =
    /\b(?:for\s+)?\d+\s*(?:days?|weeks?|months?|years?|hrs?|hours?)\b/i;

const getPrescriptionEntries = (text) => {

    const rawText = String(text || "");

    const tableMarker = "--- TABLE REGION OCR ---";
    const markerIndex = rawText.indexOf(tableMarker);

    let sourceText = markerIndex !== -1
        ? rawText.substring(markerIndex + tableMarker.length)
        : rawText;

    sourceText = cleanSection(sourceText);

    const lines = sourceText
        .split(/\r?\n/)
        .map(line => line.replace(/\|/g, " ").trim())
        .filter(Boolean);

    const entries = [];

    const rowPattern =
        /^\s*\d{1,2}[.)]\s*(.+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|μg|g|ml|iu|units?|%|tablets?|capsules?))\s+(.+?)\s+(\d+\s*(?:days?|weeks?|months?|years?|hrs?|hours?))\s*$/i;

    for (const line of lines) {

        const match = line.match(rowPattern);

        if (!match) continue;

        const medicineName = match[1].trim();
        const dosage = match[2].trim();
        const frequency = match[3].trim();
        const duration = match[4].trim();

        if (!medicineName) continue;

        if (/^(medicine|strength|frequency|duration)$/i.test(medicineName)) {
            continue;
        }

        entries.push({
            medicineText: medicineName,
            sectionText: `${medicineName} ${dosage} ${frequency} ${duration}`
        });
    }

    // Remove duplicate medicine rows.

    const uniqueEntries = [];

    for (const entry of entries) {

        const duplicate = uniqueEntries.some(
            existing =>
                normalize(existing.medicineText) ===
                normalize(entry.medicineText)
        );

        if (!duplicate) {
            uniqueEntries.push(entry);
        }
    }

    return uniqueEntries;
};

// =====================================================
// MEDICINE CATALOGUE MATCHING
// =====================================================

const findMedicinesInText = async (text) => {

    const entries = getPrescriptionEntries(text);

    console.log("Prescription rows extracted:", entries.length);

    if (entries.length === 0) {
        return [];
    }

    const [medicines] = await db.query(
        "SELECT id, name, generic_name FROM medicines"
    );

    const [aliases] = await db.query(
        `SELECT medicine_id, alias_name, normalized_alias
         FROM medicine_aliases`
    );

    const results = [];

    for (const entry of entries) {

        const originalName = entry.medicineText.trim();

        const originalNormalized = normalize(originalName);

        const correctedName = normalizeOCRMedicineName(originalName);

        const correctedNormalized = normalize(correctedName);

        // STEP 1: EXACT MATCH

        let matchedMedicine = medicines.find(medicine =>
            normalize(medicine.name) === originalNormalized ||
            normalize(medicine.generic_name) === originalNormalized
        );

        if (!matchedMedicine) {

            const matchedAlias = aliases.find(alias =>
                normalize(alias.alias_name) === originalNormalized ||
                normalize(alias.normalized_alias) === originalNormalized
            );

            if (matchedAlias) {
                matchedMedicine = medicines.find(
                    medicine => medicine.id === matchedAlias.medicine_id
                );
            }
        }

        if (matchedMedicine) {

            results.push({
                id: matchedMedicine.id,
                name: matchedMedicine.name,
                originalOcrName: originalName,
                suggestedMedicine: null,
                recognitionStatus: "recognized",
                matchConfidence: 1,
                sectionText: entry.sectionText
            });

            continue;
        }

        // STEP 2: CONTROLLED OCR CORRECTION

        if (correctedNormalized !== originalNormalized) {

            const correctionMatch = medicines.find(medicine =>
                normalize(medicine.name) === correctedNormalized ||
                normalize(medicine.generic_name) === correctedNormalized
            );

            if (correctionMatch) {

                results.push({
                    id: null,
                    name: originalName,
                    originalOcrName: originalName,
                    suggestedMedicine: correctionMatch.name,
                    recognitionStatus: "needs_review",
                    matchConfidence: 0.9,
                    sectionText: entry.sectionText
                });

                continue;
            }
        }

        // STEP 3: UNRECOGNIZED

        results.push({
            id: null,
            name: originalName,
            originalOcrName: originalName,
            suggestedMedicine: null,
            recognitionStatus: "unrecognized",
            matchConfidence: null,
            sectionText: entry.sectionText
        });
    }

    console.log(
        "Medicine recognition results:",
        results.map(m => ({
            name: m.originalOcrName,
            status: m.recognitionStatus
        }))
    );

    return results;
};

// =====================================================
// DOSAGE EXTRACTION
// =====================================================

const extractMedicineDetails = (text, detectedMedicines) => {

    return detectedMedicines.map(medicine => {

        const sectionText = medicine.sectionText || "";

        const dosageMatch = sectionText.match(dosageRegex);
        const frequencyMatch = sectionText.match(frequencyRegex);
        const durationMatch = sectionText.match(durationRegex);

        return {
            id: medicine.id,
            name: medicine.name,
            originalOcrName: medicine.originalOcrName,
            suggestedMedicine: medicine.suggestedMedicine,
            recognitionStatus: medicine.recognitionStatus,
            matchConfidence: medicine.matchConfidence,

            dosage: dosageMatch ? dosageMatch[0].trim() : null,

            frequency: frequencyMatch ? frequencyMatch[0].trim() : null,

            duration: durationMatch ? durationMatch[0].trim() : null
        };
    });
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    findMedicinesInText,
    extractMedicineDetails
};