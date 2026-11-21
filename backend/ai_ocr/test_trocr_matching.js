const fs = require("fs");
const path = require("path");

const db = require("../database/db");
const { matchTrOCRMedicines } = require("../services/trocrMedicineService");

async function main() {
    try {
        const inputPath = path.join(
            __dirname,
            "../uploads/trocr_v3/extracted_prescription.json"
        );

        const extractedData = JSON.parse(
            fs.readFileSync(inputPath, "utf8")
        );

        const result = await matchTrOCRMedicines(extractedData);

        console.log("\n========== TROCR MEDICINE MATCHING ==========\n");

        console.log("Total entries:", result.totalEntries);
        console.log("Recognized:", result.recognized);
        console.log("Unrecognized:", result.unrecognized);

        for (const entry of result.entries) {
            console.log("\nEntry:", entry.entryNumber);
            console.log("Medicine:", entry.name);
            console.log("Database ID:", entry.id);
            console.log("Original OCR:", entry.originalOcrName);
            console.log("Status:", entry.recognitionStatus);
            console.log("Confidence:", entry.matchConfidence);
            console.log("Method:", entry.matchMethod);
            console.log("Strength:", entry.dosage);
            console.log("Frequency:", entry.frequency);
            console.log("Duration:", entry.duration);
            console.log("Review:", entry.reviewReasons);
        }

        console.log("\n========== COMPLETE JSON ==========\n");
        console.log(JSON.stringify(result, null, 4));

    } catch (error) {
        console.error("Matching failed:", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
