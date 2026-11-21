const db = require("../database/db");
const { runSafetyAnalysis } = require("../services/safetyAnalysisEngine");

// =====================================================
// RUN MEDICATION SAFETY ANALYSIS
// =====================================================
const executeAnalysis = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title } = req.body;

        const report = await runSafetyAnalysis(userId, { title });

        res.json({
            success: true,
            message: "Medication safety analysis completed successfully",
            report
        });
    } catch (error) {
        console.error("Execute Analysis Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to run safety analysis: " + error.message
        });
    }
};

// =====================================================
// GET PREVIOUS REPORTS
// =====================================================
const getPreviousReports = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [reports] = await db.query(`
            SELECT id, report_title, summary_status, total_existing_meds, total_new_meds,
                   major_count, moderate_count, minor_count, unassessed_count, duplicate_count,
                   allergy_conflict_count, dosage_warning_count, created_at
            FROM analysis_reports
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        res.json({
            success: true,
            reports,
            count: reports.length
        });
    } catch (error) {
        console.error("Get Previous Reports Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve previous reports: " + error.message
        });
    }
};

// =====================================================
// GET SPECIFIC REPORT DETAILS
// =====================================================
const getReportById = async (req, res) => {
    try {
        const userId = req.user.userId;
        const reportId = Number(req.params.id);

        const [reports] = await db.query(`
            SELECT * FROM analysis_reports
            WHERE id = ? AND user_id = ?
        `, [reportId, userId]);

        if (reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        const report = reports[0];

        // Fetch findings
        const [findings] = await db.query(`
            SELECT * FROM analysis_findings
            WHERE report_id = ?
            ORDER BY FIELD(severity, 'major', 'moderate', 'minor', 'unknown', 'info'), created_at ASC
        `, [reportId]);

        let parsedSnapshot = null;
        if (report.raw_snapshot_json) {
            try {
                parsedSnapshot = typeof report.raw_snapshot_json === "string"
                    ? JSON.parse(report.raw_snapshot_json)
                    : report.raw_snapshot_json;
            } catch (e) {
                console.error("Snapshot parse warning:", e);
            }
        }

        res.json({
            success: true,
            report: {
                ...report,
                findings,
                snapshot: parsedSnapshot
            }
        });
    } catch (error) {
        console.error("Get Report Details Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve report details: " + error.message
        });
    }
};

// =====================================================
// DELETE REPORT
// =====================================================
const deleteReport = async (req, res) => {
    try {
        const userId = req.user.userId;
        const reportId = Number(req.params.id);

        const [result] = await db.query(`
            DELETE FROM analysis_reports
            WHERE id = ? AND user_id = ?
        `, [reportId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        res.json({
            success: true,
            message: "Report deleted successfully"
        });
    } catch (error) {
        console.error("Delete Report Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete report: " + error.message
        });
    }
};

// =====================================================
// GET DASHBOARD OVERVIEW STATS
// =====================================================
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Existing meds count
        const [[{ existingCount }]] = await db.query(`
            SELECT COUNT(*) as existingCount FROM user_medications
            WHERE user_id = ? AND section_type = 'existing' AND is_confirmed = 1
        `, [userId]);

        // New meds count
        const [[{ newCount }]] = await db.query(`
            SELECT COUNT(*) as newCount FROM user_medications
            WHERE user_id = ? AND section_type = 'new' AND is_confirmed = 1
        `, [userId]);

        // Allergies count
        const [[{ allergyCount }]] = await db.query(`
            SELECT COUNT(*) as allergyCount FROM user_allergies
            WHERE user_id = ?
        `, [userId]);

        // Reports count and last report
        const [reports] = await db.query(`
            SELECT id, report_title, summary_status, major_count, moderate_count, created_at
            FROM analysis_reports
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `, [userId]);

        res.json({
            success: true,
            stats: {
                existingMedsCount: existingCount,
                newMedsCount: newCount,
                allergiesCount: allergyCount,
                reportsCount: reports.length,
                lastReport: reports[0] || null,
                recentReports: reports
            }
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard stats: " + error.message
        });
    }
};

module.exports = {
    executeAnalysis,
    getPreviousReports,
    getReportById,
    deleteReport,
    getDashboardStats
};
