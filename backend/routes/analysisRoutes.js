const express = require("express");
const {
    executeAnalysis,
    getPreviousReports,
    getReportById,
    deleteReport,
    getDashboardStats
} = require("../controllers/analysisController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/run", executeAnalysis);
router.get("/reports", getPreviousReports);
router.get("/reports/:id", getReportById);
router.delete("/reports/:id", deleteReport);
router.get("/stats", getDashboardStats);

module.exports = router;
