const fs = require("fs");
const path = require("path");
const db = require("../database/db");

async function importNLEM() {
    const sql = fs.readFileSync(
        path.join(__dirname, "../data/nlem2022_import.sql"),
        "utf8"
    );

    try {
        await db.query(sql);

        const [rows] = await db.query(
            "SELECT COUNT(*) AS total FROM medicines"
        );

        console.log("NLEM catalogue imported successfully.");
        console.log("Total medicines in database:", rows[0].total);
    } catch (error) {
        console.error("Import failed:", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

importNLEM();
