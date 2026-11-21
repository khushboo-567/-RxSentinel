const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const authenticateToken = require("../middleware/authMiddleware");
const verifyPrescriptionOwnership = require("../middleware/prescriptionOwnership");
const { analyzePrescriptionAllergies } = require("../controllers/allergyController");

const {
    testPrescriptionAPI,
    getMedicines,
    uploadPrescription,
    confirmPrescriptionToSection,
    getUserPrescriptions,
    getPrescriptionById,
    checkDrugInteractions,
    checkFDAInteractions,
    checkDosage
} = require("../controllers/prescriptionController");

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Public routes
router.get("/test", testPrescriptionAPI);
router.get("/medicines", getMedicines);

// User prescriptions list & details
router.get("/user", authenticateToken, getUserPrescriptions);
router.get("/details/:id", authenticateToken, getPrescriptionById);

// Upload & OCR
router.post(
    "/upload",
    authenticateToken,
    upload.single("prescription"),
    uploadPrescription
);

// Batch confirm extracted medicines to Section A or B
router.post(
    "/confirm-to-section",
    authenticateToken,
    confirmPrescriptionToSection
);

// Analysis routes (prescription-specific)
router.get(
    "/:prescriptionId/interactions",
    authenticateToken,
    verifyPrescriptionOwnership,
    checkDrugInteractions
);

router.get(
    "/:prescriptionId/fda-interactions",
    authenticateToken,
    verifyPrescriptionOwnership,
    checkFDAInteractions
);

router.get(
    "/:prescriptionId/dosage-analysis",
    authenticateToken,
    verifyPrescriptionOwnership,
    checkDosage
);

router.get(
    "/:prescriptionId/allergy-analysis",
    authenticateToken,
    verifyPrescriptionOwnership,
    analyzePrescriptionAllergies
);

module.exports = router;
