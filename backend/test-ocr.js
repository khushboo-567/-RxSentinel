const { extractTextFromImage } = require("./services/ocrService");

const imagePath = "./uploads/1790006162764-f2.png";

extractTextFromImage(imagePath)
    .then((text) => {
        console.log("Extracted Text:");
        console.log(text);
    })
    .catch((error) => {
        console.error("OCR Error:", error);
    });