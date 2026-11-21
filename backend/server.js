const express = require("express");
const cors = require("cors");

const db = require("./database/db");
const prescriptionRoutes = require("./routes/prescriptionRoutes");

const authRoutes = require("./routes/authRoutes");

const allergyRoutes = require("./routes/allergyRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/prescriptions", prescriptionRoutes);

app.use("/api/allergies", allergyRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "RxSentinel Backend is running!"
    });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});