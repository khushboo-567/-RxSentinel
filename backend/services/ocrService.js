const { createWorker } = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// =====================================================
// GENERAL IMAGE PREPROCESSING
// =====================================================

const preprocessImage = async (imagePath) => {
    const outputPath = path.join(
        path.dirname(imagePath),
        `processed-${Date.now()}.png`
    );

    await sharp(imagePath)
        .rotate()
        .resize({ width: 2400 })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(outputPath);

    return outputPath;
};

// =====================================================
// TESSERACT OCR
// =====================================================

const recognizeRegion = async (worker, imagePath) => {
    const result = await worker.recognize(imagePath);

    return {
        text: (result.data.text || "").trim(),
        confidence: result.data.confidence || 0
    };
};

// =====================================================
// GOOGLE CLOUD VISION - HANDWRITING OCR
// =====================================================

const recognizeHandwriting = async (imagePath) => {

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!apiKey) {
        throw new Error(
            "GOOGLE_CLOUD_VISION_API_KEY is missing from .env"
        );
    }

    const imageBuffer = fs.readFileSync(imagePath);

    const base64Image = imageBuffer.toString("base64");

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                requests: [
                    {
                        image: {
                            content: base64Image
                        },

                        features: [
                            {
                                type: "DOCUMENT_TEXT_DETECTION"
                            }
                        ],

                        imageContext: {
                            languageHints: ["en"]
                        }
                    }
                ]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Google Vision API failed: ${response.status} ${errorText}`
        );
    }

    const data = await response.json();

    const result = data.responses?.[0];

    if (result?.error) {
        throw new Error(result.error.message);
    }

    const text =
        result?.fullTextAnnotation?.text?.trim() || "";

    if (!text) {
        throw new Error(
            "Google Vision could not extract readable text."
        );
    }

    // Calculate confidence from available word-level scores.

    const confidenceValues = [];

    const pages =
        result.fullTextAnnotation?.pages || [];

    for (const page of pages) {

        for (const block of page.blocks || []) {

            for (const paragraph of block.paragraphs || []) {

                for (const word of paragraph.words || []) {

                    if (
                        typeof word.confidence === "number"
                    ) {
                        confidenceValues.push(
                            word.confidence * 100
                        );
                    }
                }
            }
        }
    }

    const confidence = confidenceValues.length
        ? confidenceValues.reduce((a, b) => a + b, 0) /
          confidenceValues.length
        : 0;

    return {
        text,
        confidence: Math.round(confidence)
    };
};

// =====================================================
// CROP AND RECOGNIZE PRINTED TABLE CELLS
// =====================================================

const recognizeTable = async (imagePath, worker) => {

    const metadata = await sharp(imagePath).metadata();

    const width = metadata.width;
    const height = metadata.height;

    const table = {
        left: 0.035,
        right: 0.97,
        top: 0.405,
        bottom: 0.645
    };

    const columns = {
        medicine: [0.12, 0.397],
        strength: [0.397, 0.574],
        frequency: [0.574, 0.803],
        duration: [0.803, 0.97]
    };

    const rowHeight =
        (table.bottom - table.top) / 5;

    const columnResults = [];

    let totalConfidence = 0;
    let confidenceCount = 0;

    for (let row = 0; row < 5; row++) {

        const top = Math.round(
            height * (table.top + row * rowHeight)
        ) + 3;

        const bottom = Math.round(
            height * (table.top + (row + 1) * rowHeight)
        ) - 3;

        const rowData = {};

        for (const columnName of [
            "medicine",
            "strength",
            "frequency",
            "duration"
        ]) {

            const [start, end] = columns[columnName];

            const left = Math.round(width * start) + 2;
            const right = Math.round(width * end) - 2;

            const cropPath = path.join(
                path.dirname(imagePath),
                `ocr-${Date.now()}-${row}-${columnName}.png`
            );

            try {

                await sharp(imagePath)
                    .extract({
                        left,
                        top,
                        width: right - left,
                        height: bottom - top
                    })
                    .resize({
                        width: Math.max(
                            500,
                            (right - left) * 3
                        )
                    })
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toFile(cropPath);

                const result = await recognizeRegion(
                    worker,
                    cropPath
                );

                rowData[columnName] = result.text;

                totalConfidence += result.confidence;
                confidenceCount++;

            } finally {

                if (fs.existsSync(cropPath)) {
                    fs.unlinkSync(cropPath);
                }
            }
        }

        columnResults.push(rowData);
    }

    const reconstructedRows = columnResults.map(
        (row, index) => {
            return `${index + 1}. ${row.medicine} ${row.strength} ${row.frequency} ${row.duration}`;
        }
    );

    return {
        text: reconstructedRows.join("\n"),

        confidence: confidenceCount
            ? totalConfidence / confidenceCount
            : 0,

        rows: columnResults
    };
};

// =====================================================
// MAIN OCR FUNCTION
// =====================================================

const extractTextWithConfidence = async (imagePath) => {

    let processedPath;

    const worker = await createWorker("eng");

    try {

        // STEP 1: NORMAL TESSERACT OCR

        processedPath = await preprocessImage(imagePath);

        await worker.setParameters({
            tessedit_pageseg_mode: "6"
        });

        const fullPageResult = await recognizeRegion(
            worker,
            processedPath
        );

        let extractedText = "";
        let finalConfidence = 0;
        let ocrMode = "tesseract";

        // STEP 2: HANDWRITING FALLBACK

        if (fullPageResult.confidence < 45) {

            console.log(
                "Low OCR confidence. Trying handwriting recognition..."
            );

            try {

                const handwritingResult =
                    await recognizeHandwriting(imagePath);

                extractedText = handwritingResult.text;

                finalConfidence =
                    handwritingResult.confidence;

                ocrMode = "google_vision_handwriting";

                console.log(
                    "HANDWRITING OCR:",
                    handwritingResult.text
                );

                console.log(
                    "HANDWRITING CONFIDENCE:",
                    handwritingResult.confidence
                );

            } catch (error) {

                console.error(
                    "Handwriting OCR fallback failed:",
                    error.message
                );

                // Preserve the original Tesseract result.

                extractedText = fullPageResult.text;

                finalConfidence =
                    fullPageResult.confidence;

                ocrMode = "tesseract_fallback";
            }

        } else {

            // STEP 3: PRINTED PRESCRIPTION TABLE OCR

            await worker.setParameters({
                tessedit_pageseg_mode: "7"
            });

            const tableResult = await recognizeTable(
                imagePath,
                worker
            );

            extractedText = [
                fullPageResult.text,
                "\n\n--- TABLE REGION OCR ---\n",
                tableResult.text
            ].join("");

            finalConfidence = Math.round(
                (
                    fullPageResult.confidence +
                    tableResult.confidence
                ) / 2
            );

            console.log(
                "RECONSTRUCTED TABLE:",
                tableResult.rows
            );
        }

        console.log("OCR MODE:", ocrMode);
        console.log("FINAL OCR TEXT:", extractedText);
        console.log("FINAL OCR CONFIDENCE:", finalConfidence);

        return {
            text: extractedText,
            confidence: Math.round(finalConfidence),
            ocrMode
        };

    } catch (error) {

        console.error("OCR Processing Error:", error);

        throw error;

    } finally {

        await worker.terminate();

        if (processedPath && fs.existsSync(processedPath)) {
            fs.unlinkSync(processedPath);
        }
    }
};

// =====================================================
// COMPATIBILITY FUNCTION
// =====================================================

const extractTextFromImage = async (imagePath) => {

    const result = await extractTextWithConfidence(imagePath);

    return result.text;
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    extractTextFromImage,
    extractTextWithConfidence,
    preprocessImage
};