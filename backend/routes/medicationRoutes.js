const express = require("express");
const {
    getMedications,
    searchMedicines,
    addMedication,
    updateMedication,
    deleteMedication,
    batchConfirmMedications,
    clearSection
} = require("../controllers/medicationController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getMedications);
router.get("/search", searchMedicines);
router.post("/", addMedication);
router.post("/batch-confirm", batchConfirmMedications);
router.put("/:id", updateMedication);
router.delete("/:id", deleteMedication);
router.delete("/clear/:section", clearSection);

module.exports = router;
