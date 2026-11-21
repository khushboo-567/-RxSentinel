const db = require("../database/db");

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const excludedPatterns = [
    /vaccine/i,
    /immunoglobulin/i,
    /antitoxin/i,
    /antiserum/i,
    /coagulation factor/i,
    /cryoprecipitate/i,
    /fresh frozen plasma/i,
    /platelet/i,
    /red blood cells/i,
    /packed rbcs/i,
    /whole blood/i,
    /condom/i,
    /\biud\b/i,
    /dialysis fluid/i,
    /dialysis solution/i,
    /oral rehydration salts/i,
    /ringer lactate/i,
    /water for injection/i,
    /denatured/i,
    /ferrous salts/i,
    /surfactant/i,
    /nicotine replacement therapy/i,
    /insulin premix/i,
    /snake venom/i,
    /podophyllin resin/i,
    /^calamine$/i
];

const canonicalNames = {
    "5-aminosalicylic acid (Mesalazine/Mesalaine)": "Mesalazine",
    "Acetylsalicylic acid": "Aspirin",
    "Ascorbic acid (Vitamin C)": "Ascorbic acid",
    "All-trans retinoic acid": "Tretinoin",
    "Cytosine arabinoside": "Cytarabine",
    "D- Penicillamine": "Penicillamine",
    "Hydroxocobalamine": "Hydroxocobalamin",
    "Irinotecan HCI Trihydrate": "Irinotecan",
    "Methylrosanilinium chloride (Gentian Violet)": "Gentian violet",
    "Methylthioninium chloride (Methylene blue)": "Methylene blue",
    "Ormeloxifene (Centchroman)": "Ormeloxifene",
    "Phytomenadione(Vitamin K1)": "Phytomenadione",
    "Pralidoxime chloride (2-PAM)": "Pralidoxime",
    "Sodium Valproate": "Sodium valproate",
    "Tenofovir Disproxil Fumarate (TDF)": "Tenofovir disoproxil fumarate",
    "Tenofovir Alafenamide Fumarate (TAF)": "Tenofovir alafenamide"
};

const mapSingleIngredients = async () => {
    let mapped = 0;
    let skipped = 0;

    const [medicines] = await db.query(
        `SELECT m.id, m.name
         FROM medicines m
         LEFT JOIN medicine_ingredients mi ON mi.medicine_id = m.id
         WHERE mi.medicine_id IS NULL
         ORDER BY m.id`
    );

    for (const medicine of medicines) {
        if (excludedPatterns.some(pattern => pattern.test(medicine.name))) {
            skipped++;
            continue;
        }

        const ingredientName =
            canonicalNames[medicine.name] || medicine.name;

        const normalizedName = normalize(ingredientName);

        if (!normalizedName) {
            skipped++;
            continue;
        }

        await db.query(
            `INSERT IGNORE INTO active_ingredients
            (name, normalized_name, source_name, source_identifier)
            VALUES (?, ?, ?, ?)`,
            [
                ingredientName,
                normalizedName,
                "NLEM 2022",
                `NLEM2022-${normalizedName}`
            ]
        );

        const [ingredients] = await db.query(
            `SELECT id FROM active_ingredients
             WHERE normalized_name = ?
             LIMIT 1`,
            [normalizedName]
        );

        if (ingredients.length === 0) {
            skipped++;
            continue;
        }

        await db.query(
            `INSERT IGNORE INTO medicine_ingredients
            (medicine_id, ingredient_id, ingredient_strength)
            VALUES (?, ?, NULL)`,
            [medicine.id, ingredients[0].id]
        );

        mapped++;
    }

    const [[summary]] = await db.query(
        `SELECT
            COUNT(DISTINCT m.id) AS total_medicines,
            COUNT(DISTINCT mi.medicine_id) AS mapped_medicines,
            COUNT(DISTINCT ai.id) AS total_active_ingredients
         FROM medicines m
         LEFT JOIN medicine_ingredients mi ON mi.medicine_id = m.id
         LEFT JOIN active_ingredients ai ON ai.id = mi.ingredient_id`
    );

    console.log("\nIngredient mapping completed.");
    console.log("New medicine mappings:", mapped);
    console.log("Skipped medicines:", skipped);
    console.log("Total medicines:", summary.total_medicines);
    console.log("Medicines with ingredient mappings:", summary.mapped_medicines);
    console.log("Total active ingredients:", summary.total_active_ingredients);

    await db.end();
};

mapSingleIngredients().catch(async error => {
    console.error("Mapping failed:", error);
    await db.end();
    process.exit(1);
});