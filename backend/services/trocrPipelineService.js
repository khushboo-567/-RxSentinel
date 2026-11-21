const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const { preprocessImage } = require("./ocrService");
const { matchTrOCRMedicines } = require("./trocrMedicineService");

const execFileAsync = promisify(execFile);

const BACKEND_DIR = path.resolve(__dirname, "..");

const PYTHON = path.join(
    BACKEND_DIR,
    "trocr_env",
    "Scripts",
    "python.exe"
);

const PROCESS_SCRIPT = path.join(
    BACKEND_DIR,
    "ai_ocr",
    "process_prescription.py"
);

const EXTRACT_SCRIPT = path.join(
    BACKEND_DIR,
    "ai_ocr",
    "extract_prescription_fields.py"
);

const UPLOAD_DIR = path.join(
    BACKEND_DIR,
    "uploads",
    "trocr_runs"
);

async function runPython(script, args) {
    const { stdout, stderr } = await execFileAsync(
        PYTHON,
        [script, ...args],
        {
            cwd: BACKEND_DIR,
            windowsHide: true,
            maxBuffer: 20 * 1024 * 1024,
            timeout: 300000
        }
    );

    if (stdout) {
        console.log(stdout);
    }

    if (stderr) {
        console.log("Python warnings:", stderr);
    }

    return stdout;
}

async function processHandwrittenPrescription(imagePath) {
    if (!imagePath || !fs.existsSync(imagePath)) {
        throw new Error("Uploaded handwritten prescription image not found.");
    }

    if (!fs.existsSync(PYTHON)) {
        throw new Error("TrOCR Python environment not found.");
    }

    const absoluteImagePath = path.resolve(imagePath);

    const runId =
        `${path.parse(absoluteImagePath).name}_${Date.now()}`;

    const outputDir = path.join(UPLOAD_DIR, runId);

    fs.mkdirSync(outputDir, { recursive: true });

    let processedImagePath;

    try {
        console.log("\n========== HANDWRITTEN PRESCRIPTION PIPELINE ==========");

        // STEP 1: Preprocess image.
        console.log("\nSTEP 1: Preprocessing handwritten prescription...");

        processedImagePath = await preprocessImage(absoluteImagePath);

        if (!fs.existsSync(processedImagePath)) {
            throw new Error("Image preprocessing failed.");
        }

        // STEP 2: Run TrOCR.
        console.log("\nSTEP 2: Running TrOCR recognition...");

        const rawJsonPath = path.join(
            outputDir,
            "prescription.json"
        );

        await runPython(PROCESS_SCRIPT, [
            "--input",
            processedImagePath,
            "--output-dir",
            outputDir
        ]);

        if (!fs.existsSync(rawJsonPath)) {
            throw new Error("TrOCR did not generate prescription.json.");
        }

        // STEP 3: Extract prescription fields.
        console.log("\nSTEP 3: Extracting prescription fields...");

        const extractedJsonPath = path.join(
            outputDir,
            "extracted_prescription.json"
        );

        await runPython(EXTRACT_SCRIPT, [
            "--input",
            rawJsonPath,
            "--output",
            extractedJsonPath
        ]);

        if (!fs.existsSync(extractedJsonPath)) {
            throw new Error("Prescription field extraction failed.");
        }

        const extractedData = JSON.parse(
            fs.readFileSync(extractedJsonPath, "utf8")
        );

        if (!extractedData.success) {
            throw new Error("Invalid extracted prescription data.");
        }

        // STEP 4: Match medicines against MySQL catalogue.
        console.log("\nSTEP 4: Matching medicines with database...");

        const matchingResult = await matchTrOCRMedicines(
            extractedData
        );

        console.log("\nHANDWRITTEN PIPELINE COMPLETED");

        return {
            success: true,
            ocrEngine: "TrOCR",
            processingMode: "handwritten",
            rawOcr: JSON.parse(
                fs.readFileSync(rawJsonPath, "utf8")
            ),
            extractedData,
            medicineMatching: matchingResult,
            outputDirectory: path.relative(
                BACKEND_DIR,
                outputDir
            )
        };

    } catch (error) {
        console.error(
            "Handwritten prescription processing failed:",
            error
        );

        throw error;

    } finally {
        // Preserve processed files for debugging and audit.
    }
}

module.exports = {
    processHandwrittenPrescription
};
