const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./database/db");
const authRoutes = require("./routes/authRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const allergyRoutes = require("./routes/allergyRoutes");
const analysisRoutes = require("./routes/analysisRoutes");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Static uploads serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Route Registration
app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/allergies", allergyRoutes);
app.use("/api/analysis", analysisRoutes);

// Health Check
app.get("/api/health", async (req, res) => {
    try {
        const [dbCheck] = await db.query("SELECT 1 as connected");
        res.json({
            status: "healthy",
            app: "RxSentinel Backend API",
            timestamp: new Date().toISOString(),
            database: dbCheck.length > 0 ? "connected" : "disconnected"
        });
    } catch (err) {
        res.status(500).json({
            status: "unhealthy",
            database: "error",
            message: err.message
        });
    }
});

app.get("/", (req, res) => {
    res.json({
        message: "RxSentinel – AI-Powered Medication Safety Checker Backend is operational."
    });
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Backend Error:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error occurred."
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` RxSentinel Backend running on port ${PORT}`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
