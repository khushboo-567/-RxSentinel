const db = require("../database/db");

const combinations = {
    9: ["Abacavir", "Lamivudine"],
    25: ["Amoxicillin", "Clavulanic acid"],
    32: ["Artemether", "Lumefantrine"],
    34: ["Artesunate", "Sulphadoxine", "Pyrimethamine"],
    36: ["Atazanavir", "Ritonavir"],
    60: ["Buprenorphine", "Naloxone"],
    97: ["Coal tar", "Salicylic acid"],
    100: ["Sulphamethoxazole", "Trimethoprim"],
    112: ["Darunavir", "Ritonavir"],
    144: ["Ethinylestradiol", "Levonorgestrel"],
    149: ["Ferrous salts", "Folic acid"],
    169: ["Glucose", "Sodium chloride"],
    221: ["Levodopa", "Carbidopa"],
    226: ["Lignocaine", "Adrenaline"],
    230: ["Lopinavir", "Ritonavir"],
    294: ["Piperacillin", "Tazobactam"],
    350: ["Tenofovir", "Lamivudine"],
    351: ["Tenofovir", "Lamivudine", "Dolutegravir"],
    352: ["Tenofovir", "Lamivudine", "Efavirenz"],
    380: ["Zidovudine", "Lamivudine"],
    381: ["Zidovudine", "Lamivudine", "Nevirapine"]
};

const normalize = value =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
    let mapped = 0;

    for (const [medicineId, ingredients] of Object.entries(combinations)) {
        for (const ingredient of ingredients) {
            const normalized = normalize(ingredient);

            await db.query(
                `INSERT INTO active_ingredients
                (name, normalized_name, source_name, source_identifier)
                VALUES (?, ?, 'NLEM 2022', ?)
                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [ingredient, normalized, `NLEM2022-${normalized}`]
            );

            const [rows] = await db.query(
                "SELECT id FROM active_ingredients WHERE normalized_name = ?",
                [normalized]
            );

            await db.query(
                `INSERT IGNORE INTO medicine_ingredients
                (medicine_id, ingredient_id)
                VALUES (?, ?)`,
                [Number(medicineId), rows[0].id]
            );
        }
        mapped++;
    }

    const [result] = await db.query(
        `SELECT COUNT(DISTINCT medicine_id) AS mapped_combinations
         FROM medicine_ingredients
         WHERE medicine_id IN (?)`,
        [Object.keys(combinations).map(Number)]
    );

    console.log("Combination medicines processed:", mapped);
    console.log("Combination medicines with mappings:", result[0].mapped_combinations);
}

main()
    .catch(error => {
        console.error("Mapping failed:", error);
        process.exitCode = 1;
    })
    .finally(() => db.end());
