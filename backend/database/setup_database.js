const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/../.env" });

async function columnExists(connection, tableName, columnName) {
    const [rows] = await connection.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [process.env.DB_NAME || "rxsentinel", tableName, columnName]);
    return rows.length > 0;
}

async function ensureColumn(connection, tableName, columnName, definition) {
    const exists = await columnExists(connection, tableName, columnName);
    if (!exists) {
        console.log(`Adding column ${columnName} to ${tableName}...`);
        await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function setupDatabase() {
    console.log("Connecting to MySQL...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "rxsentinel",
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    console.log("Connected successfully. Applying schema migrations...");

    // 1. Users table update
    await ensureColumn(connection, "users", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    // 2. User Profiles table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            age INT NULL,
            gender VARCHAR(50) NULL,
            weight_kg DECIMAL(5,2) NULL,
            medical_conditions TEXT NULL,
            emergency_contact VARCHAR(100) NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 3. Medicines enhancements
    await ensureColumn(connection, "medicines", "brand_name", "VARCHAR(150) NULL");
    await ensureColumn(connection, "medicines", "dosage_form", "VARCHAR(100) NULL");
    await ensureColumn(connection, "medicines", "standard_strength", "VARCHAR(100) NULL");

    // 4. Active ingredients enhancements
    await ensureColumn(connection, "active_ingredients", "max_daily_dose_mg", "DECIMAL(10,2) NULL");

    // 5. Medicine ingredients enhancements
    await ensureColumn(connection, "medicine_ingredients", "strength_mg", "DECIMAL(10,2) NULL");

    // 6. Medicine aliases table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS medicine_aliases (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            medicine_id INT NOT NULL,
            alias_name VARCHAR(200) NOT NULL,
            normalized_alias VARCHAR(200) NOT NULL,
            alias_type ENUM('brand','generic','synonym','common_name','spelling_variant') NOT NULL DEFAULT 'brand',
            source_name VARCHAR(100) NULL,
            source_identifier VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_medicine_id (medicine_id),
            KEY idx_normalized_alias (normalized_alias),
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 7. Prescriptions enhancements
    await ensureColumn(connection, "prescriptions", "section_type", "ENUM('existing', 'new', 'allergy_record') DEFAULT 'existing'");
    await ensureColumn(connection, "prescriptions", "prescription_type", "ENUM('printed', 'handwritten') DEFAULT 'printed'");
    await ensureColumn(connection, "prescriptions", "ocr_engine", "VARCHAR(50) NULL");
    await ensureColumn(connection, "prescriptions", "ocr_confidence", "DECIMAL(5,2) NULL");

    // 8. User medications table (Section A: Existing vs Section B: New)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS user_medications (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            section_type ENUM('existing', 'new') NOT NULL,
            medicine_id INT NULL,
            medicine_name VARCHAR(150) NOT NULL,
            generic_name VARCHAR(150) NULL,
            strength VARCHAR(100) NULL,
            dosage VARCHAR(100) NULL,
            frequency VARCHAR(100) NULL,
            duration VARCHAR(100) NULL,
            start_date DATE NULL,
            source ENUM('manual', 'ocr') DEFAULT 'manual',
            prescription_id INT NULL,
            is_confirmed TINYINT(1) DEFAULT 1,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_user_section (user_id, section_type),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL,
            FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 9. User allergies enhancements
    await ensureColumn(connection, "user_allergies", "allergen_ingredient_id", "INT NULL");
    await ensureColumn(connection, "user_allergies", "source", "ENUM('manual', 'ocr') DEFAULT 'manual'");
    await ensureColumn(connection, "user_allergies", "notes", "TEXT NULL");
    await ensureColumn(connection, "user_allergies", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    // 10. Drug Interactions table rebuild / sync
    const hasIng1 = await columnExists(connection, "drug_interactions", "ingredient_id_1");
    if (!hasIng1) {
        console.log("Upgrading drug_interactions table to active ingredient schema...");
        await connection.query(`DROP TABLE IF EXISTS drug_interactions`);
        await connection.query(`
            CREATE TABLE drug_interactions (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ingredient_id_1 INT NOT NULL,
                ingredient_id_2 INT NOT NULL,
                severity ENUM('major','moderate','minor','unknown') NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                clinical_effect TEXT NULL,
                mechanism TEXT NULL,
                recommendation TEXT NOT NULL,
                source_name VARCHAR(255) DEFAULT 'FDA / Lexicomp / Clinical Pharmacology',
                source_url TEXT NULL,
                evidence_summary TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_ingredient_pair (ingredient_id_1, ingredient_id_2),
                KEY idx_ingredient_1 (ingredient_id_1),
                KEY idx_ingredient_2 (ingredient_id_2),
                FOREIGN KEY (ingredient_id_1) REFERENCES active_ingredients(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id_2) REFERENCES active_ingredients(id) ON DELETE CASCADE,
                CONSTRAINT chk_drug_int_pair CHECK (ingredient_id_1 < ingredient_id_2)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);
    }

    // 11. Analysis reports table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS analysis_reports (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            report_title VARCHAR(255) DEFAULT 'Medication Safety Analysis',
            summary_status ENUM('safe', 'moderate_warning', 'major_danger', 'unassessed_info') DEFAULT 'safe',
            total_existing_meds INT DEFAULT 0,
            total_new_meds INT DEFAULT 0,
            major_count INT DEFAULT 0,
            moderate_count INT DEFAULT 0,
            minor_count INT DEFAULT 0,
            unassessed_count INT DEFAULT 0,
            duplicate_count INT DEFAULT 0,
            allergy_conflict_count INT DEFAULT 0,
            dosage_warning_count INT DEFAULT 0,
            raw_snapshot_json LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_user_report (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 12. Analysis findings table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS analysis_findings (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            report_id INT NOT NULL,
            finding_type ENUM('drug_interaction', 'allergy_conflict', 'duplicate_ingredient', 'dosage_warning', 'unrecognized_medicine', 'unassessed_pair') NOT NULL,
            severity ENUM('major', 'moderate', 'minor', 'info', 'unknown') NOT NULL,
            medicine_1_name VARCHAR(150) NULL,
            medicine_2_name VARCHAR(150) NULL,
            ingredient_1_name VARCHAR(150) NULL,
            ingredient_2_name VARCHAR(150) NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            clinical_implication TEXT NULL,
            recommendation TEXT NOT NULL,
            evidence_source VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_report_finding (report_id),
            FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log("Schema migration completed successfully!");
    await connection.end();
}

setupDatabase().catch(err => {
    console.error("Migration error:", err);
    process.exit(1);
});
