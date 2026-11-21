const express = require("express");
const multer = require("multer");

const authenticateToken = require("../middleware/authMiddleware");

const verifyPrescriptionOwnership = require("../middleware/prescriptionOwnership");

const { analyzePrescriptionAllergies } = require("../controllers/allergyController");

const {
    testPrescriptionAPI,
    getMedicines,
    uploadPrescription,
    checkDrugInteractions,
    checkFDAInteractions,
    checkDosage
} = require("../controllers/prescriptionController");

const router = express.Router();

// ======================================
// MULTER CONFIGURATION
// ======================================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },

    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

// ======================================
// PUBLIC ROUTES
// ======================================

router.get("/test", testPrescriptionAPI);

router.get("/medicines", getMedicines);

// ======================================
// PROTECTED ANALYSIS ROUTES
// ======================================

// Drug interaction analysis
router.get(
    "/:prescriptionId/interactions",
    authenticateToken,
    verifyPrescriptionOwnership,
    checkDrugInteractions
);

// FDA interaction analysis
router.get(
    "/:prescriptionId/fda-interactions",
    authenticateToken,
    verifyPrescriptionOwnership,
    checkFDAInteractions
);

// Dosage information analysis
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

// ======================================
// PROTECTED UPLOAD ROUTE
// ======================================

router.post(
    "/upload",
    authenticateToken,
    upload.single("prescription"),
    uploadPrescription
);

module.exports = router;