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
// STOP PATTERNS & REGEXES
// =====================================================

const stopPattern =
    /important notes|additional instructions|doctor.?s signature|disclaimer|precautions|warning|consult your doctor/i;

const cleanSection = (value) => {
    const text = String(value || "");
    const stopIndex = text.search(stopPattern);
    return stopIndex >= 0 ? text.substring(0, stopIndex).trim() : text.trim();
};

const dosageRegex =
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|μg|g|ml|iu|units?|%|tablets?|capsules?)\b/i;

const frequencyRegex =
    /\b(?:four\s+times\s+daily|thrice\s+daily|three\s+times\s+daily|twice\s+daily|once\s+daily|once\s+nightly|twice\s+weekly|once|twice|thrice|daily|weekly|monthly|every\s+\d+\s+hours?|morning|night|bedtime|as\s+needed|when\s+required|bid|tid|qid|od|bd|tds|qds|prn)\b/i;

const durationRegex =
    /\b(?:for\s+)?\d+\s*(?:days?|weeks?|months?|years?|hrs?|hours?)\b/i;

// =====================================================
// PRESCRIPTION ROW EXTRACTION
// =====================================================

const getPrescriptionEntries = (text) => {
    const rawText = String(text || "");
    // Use full clean text
    const cleanText = cleanSection(rawText.replace(/\|/g, " "));

    const lines = cleanText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    const entries = [];

    // Helper to extract components from a line or block
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match numbered lines like "1. Paracetamol — 500 mg", "1) Ibuprofen 400mg", "Rx: Amoxicillin"
        const numMatch = line.match(/^\s*(?:\d{1,2}[.)]\s*|rx\s*[:\.]?\s*)(.+)/i);
        if (numMatch) {
            let medLine = numMatch[1].trim();

            // Check if subsequent line contains dosage or frequency e.g. "(1 tablet, Twice daily)"
            let subLine = "";
            if (i + 1 < lines.length && (lines[i + 1].startsWith("(") || frequencyRegex.test(lines[i + 1]))) {
                subLine = lines[i + 1].trim();
                i++; // skip next line as it belongs to this entry
            }

            const combinedSection = `${medLine} ${subLine}`.trim();

            // Extract medicine name by removing strength, dosage, and punctuation
            let medName = medLine
                .replace(/[—–\-]/g, " ")
                .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|μg|g|ml|iu|units?)\b/gi, "")
                .replace(/\(.*?\)/g, "")
                .trim();

            if (medName.length >= 3 && !/^(table|region|patient|doctor|prescription|date|name|age|sex)$/i.test(medName)) {
                entries.push({
                    medicineText: medName,
                    sectionText: combinedSection
                });
            }
        } else {
            // Also check for lines with strength like "Paracetamol 500mg" or "Ibuprofen 400mg"
            const strengthMatch = line.match(/^([A-Za-z\s]{3,35})\s*[-—–]?\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))\b/i);
            if (strengthMatch) {
                const medName = strengthMatch[1].trim();
                if (!/^(patient|doctor|clinic|hospital|prescription)$/i.test(medName)) {
                    entries.push({
                        medicineText: medName,
                        sectionText: line
                    });
                }
            }
        }
    }

    // Remove duplicates
    const uniqueEntries = [];
    for (const entry of entries) {
        const duplicate = uniqueEntries.some(
            existing => normalize(existing.medicineText) === normalize(entry.medicineText)
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
    let entries = getPrescriptionEntries(text);

    const [medicines] = await db.query(
        "SELECT id, name, generic_name FROM medicines"
    );

    const [aliases] = await db.query(
        "SELECT medicine_id, alias_name, normalized_alias FROM medicine_aliases"
    );

    // Fallback: If no structured entries found, search for known medicine names directly in raw text
    if (entries.length === 0) {
        console.log("No structured numbered lines found, scanning text for catalog keywords...");
        const cleanRaw = cleanSection(text);
        for (const med of medicines) {
            const regex = new RegExp(`\\b${med.name}\\b`, "i");
            if (regex.test(cleanRaw)) {
                entries.push({
                    medicineText: med.name,
                    sectionText: cleanRaw
                });
            }
        }
    }

    console.log("Prescription rows extracted:", entries.length);

    if (entries.length === 0) {
        return [];
    }

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
                alias.normalized_alias === originalNormalized
            );

            if (matchedAlias) {
                matchedMedicine = medicines.find(
                    medicine => medicine.id === matchedAlias.medicine_id
                );
            }
        }

        if (matchedMedicine) {
            results.push({
                ...matchedMedicine,
                originalOcrName: originalName,
                recognitionStatus: "recognized",
                matchConfidence: 95.0,
                medicineCandidates: [],
                recognitionReviewStatus: "not_required",
                reviewReasons: [],
                sectionText: entry.sectionText
            });
            continue;
        }

        // STEP 2: CORRECTED OCR NAME MATCH
        if (correctedNormalized !== originalNormalized) {
            let correctedMatch = medicines.find(medicine =>
                normalize(medicine.name) === correctedNormalized ||
                normalize(medicine.generic_name) === correctedNormalized
            );

            if (!correctedMatch) {
                const correctedAlias = aliases.find(alias =>
                    alias.normalized_alias === correctedNormalized
                );
                if (correctedAlias) {
                    correctedMatch = medicines.find(
                        medicine => medicine.id === correctedAlias.medicine_id
                    );
                }
            }

            if (correctedMatch) {
                results.push({
                    ...correctedMatch,
                    originalOcrName: originalName,
                    recognitionStatus: "recognized",
                    matchConfidence: 85.0,
                    medicineCandidates: [],
                    recognitionReviewStatus: "not_required",
                    reviewReasons: ["Minor OCR character correction applied"],
                    sectionText: entry.sectionText
                });
                continue;
            }
        }

        // STEP 3: SUBSTRING / PARTIAL MATCH
        const candidateMatches = [];
        for (const med of medicines) {
            const medNorm = normalize(med.name);
            if (medNorm.length >= 4 && (originalNormalized.includes(medNorm) || medNorm.includes(originalNormalized))) {
                candidateMatches.push(med);
            }
        }

        if (candidateMatches.length === 1) {
            results.push({
                ...candidateMatches[0],
                originalOcrName: originalName,
                recognitionStatus: "recognized",
                matchConfidence: 80.0,
                medicineCandidates: [],
                recognitionReviewStatus: "not_required",
                reviewReasons: [],
                sectionText: entry.sectionText
            });
        } else if (candidateMatches.length > 1) {
            results.push({
                id: null,
                name: originalName,
                generic_name: null,
                originalOcrName: originalName,
                recognitionStatus: "needs_review",
                matchConfidence: 65.0,
                medicineCandidates: candidateMatches.slice(0, 4),
                recognitionReviewStatus: "needs_review",
                reviewReasons: ["Multiple medicine candidates detected"],
                sectionText: entry.sectionText
            });
        } else {
            results.push({
                id: null,
                name: originalName,
                generic_name: null,
                originalOcrName: originalName,
                recognitionStatus: "unrecognized",
                matchConfidence: 40.0,
                medicineCandidates: [],
                recognitionReviewStatus: "needs_review",
                reviewReasons: ["No matching medicine found in database"],
                sectionText: entry.sectionText
            });
        }
    }

    return results;
};

// =====================================================
// EXTRACT DETAILS (DOSAGE, FREQUENCY, DURATION)
// =====================================================

const extractMedicineDetails = (fullText, detectedMedicines) => {
    return detectedMedicines.map(med => {
        const text = med.sectionText || fullText;

        const dosageMatch = text.match(dosageRegex);
        const freqMatch = text.match(frequencyRegex);
        const durMatch = text.match(durationRegex);

        return {
            id: med.id,
            matched_name: med.name,
            originalOcrName: med.originalOcrName,
            generic_name: med.generic_name,
            dosage: dosageMatch ? dosageMatch[0].trim() : null,
            strength: dosageMatch ? dosageMatch[0].trim() : null,
            frequency: freqMatch ? freqMatch[0].trim() : null,
            duration: durMatch ? durMatch[0].trim() : null,
            recognitionStatus: med.recognitionStatus,
            matchConfidence: med.matchConfidence,
            medicineCandidates: med.medicineCandidates,
            recognitionReviewStatus: med.recognitionReviewStatus,
            reviewReasons: med.reviewReasons,
            originalOcrText: med.sectionText
        };
    });
};

module.exports = {
    normalize,
    normalizeOCRMedicineName,
    cleanSection,
    getPrescriptionEntries,
    findMedicinesInText,
    extractMedicineDetails
};
