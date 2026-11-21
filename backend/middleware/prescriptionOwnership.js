const db = require("../database/db");

const verifyPrescriptionOwnership = async (req, res, next) => {
    try {
        const prescriptionId = Number(req.params.prescriptionId);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid prescription ID"
            });
        }

        const [rows] = await db.query(
            "SELECT id FROM prescriptions WHERE id = ? AND user_id = ?",
            [prescriptionId, req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Prescription not found for this account"
            });
        }

        next();

    } catch (error) {
        console.error("Prescription ownership check failed:", error);

        res.status(500).json({
            success: false,
            message: "Unable to verify prescription ownership"
        });
    }
};

module.exports = verifyPrescriptionOwnership;