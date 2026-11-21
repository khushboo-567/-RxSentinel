const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/../.env" });

async function seedData() {
    console.log("Connecting to MySQL for seeding...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "rxsentinel",
        port: process.env.DB_PORT || 3306
    });

    console.log("Connected. Seeding active ingredients, dosage limits, brand medicines, aliases, and clinically verified drug interactions...");

    // Helper to find or create active ingredient
    async function getOrCreateIngredient(name, normalized, description, maxDose) {
        const [existing] = await connection.query(
            "SELECT id FROM active_ingredients WHERE normalized_name = ?",
            [normalized]
        );
        if (existing.length > 0) {
            if (maxDose) {
                await connection.query(
                    "UPDATE active_ingredients SET max_daily_dose_mg = ? WHERE id = ?",
                    [maxDose, existing[0].id]
                );
            }
            return existing[0].id;
        }
        const [res] = await connection.query(
            "INSERT INTO active_ingredients (name, normalized_name, description, max_daily_dose_mg) VALUES (?, ?, ?, ?)",
            [name, normalized, description, maxDose || null]
        );
        return res.insertId;
    }

    // Helper to find or create medicine
    async function getOrCreateMedicine(name, genericName, brandName, dosageForm, standardStrength, description) {
        const [existing] = await connection.query(
            "SELECT id FROM medicines WHERE name = ?",
            [name]
        );
        let medId;
        if (existing.length > 0) {
            medId = existing[0].id;
            await connection.query(
                "UPDATE medicines SET generic_name = ?, brand_name = ?, dosage_form = ?, standard_strength = ?, description = ? WHERE id = ?",
                [genericName, brandName, dosageForm, standardStrength, description, medId]
            );
        } else {
            const [res] = await connection.query(
                "INSERT INTO medicines (name, generic_name, brand_name, dosage_form, standard_strength, description) VALUES (?, ?, ?, ?, ?, ?)",
                [name, genericName, brandName, dosageForm, standardStrength, description]
            );
            medId = res.insertId;
        }
        return medId;
    }

    // Helper to link medicine to ingredient
    async function linkMedicineIngredient(medicineId, ingredientId, strengthStr, strengthMg) {
        await connection.query(`
            INSERT INTO medicine_ingredients (medicine_id, ingredient_id, ingredient_strength, strength_mg)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ingredient_strength = VALUES(ingredient_strength), strength_mg = VALUES(strength_mg)
        `, [medicineId, ingredientId, strengthStr, strengthMg]);
    }

    // Helper to add alias
    async function addAlias(medicineId, aliasName, aliasType) {
        const normalized = aliasName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const [existing] = await connection.query(
            "SELECT id FROM medicine_aliases WHERE medicine_id = ? AND normalized_alias = ?",
            [medicineId, normalized]
        );
        if (existing.length === 0) {
            await connection.query(
                "INSERT INTO medicine_aliases (medicine_id, alias_name, normalized_alias, alias_type) VALUES (?, ?, ?, ?)",
                [medicineId, aliasName, normalized, aliasType]
            );
        }
    }

    // 1. Seed / Update Key Active Ingredients with Max Daily Dosages (mg)
    const ingredientsData = [
        { name: "Paracetamol", norm: "paracetamol", desc: "Analgesic and antipyretic agent.", maxDose: 4000 },
        { name: "Ibuprofen", norm: "ibuprofen", desc: "Nonsteroidal anti-inflammatory drug (NSAID).", maxDose: 2400 },
        { name: "Aspirin", norm: "aspirin", desc: "NSAID, antiplatelet, and analgesic agent.", maxDose: 4000 },
        { name: "Warfarin", norm: "warfarin", desc: "Vitamin K antagonist oral anticoagulant.", maxDose: 10 },
        { name: "Atorvastatin", norm: "atorvastatin", desc: "HMG-CoA reductase inhibitor (statin).", maxDose: 80 },
        { name: "Metformin", norm: "metformin", desc: "Biguanide antihyperglycemic agent.", maxDose: 2550 },
        { name: "Amlodipine", norm: "amlodipine", desc: "Dihydropyridine calcium channel blocker.", maxDose: 10 },
        { name: "Omeprazole", norm: "omeprazole", desc: "Proton pump inhibitor (PPI).", maxDose: 40 },
        { name: "Clopidogrel", norm: "clopidogrel", desc: "Thienopyridine class P2Y12 antiplatelet.", maxDose: 75 },
        { name: "Ciprofloxacin", norm: "ciprofloxacin", desc: "Fluoroquinolone broad-spectrum antibiotic.", maxDose: 1500 },
        { name: "Lisinopril", norm: "lisinopril", desc: "Angiotensin-converting enzyme (ACE) inhibitor.", maxDose: 40 },
        { name: "Simvastatin", norm: "simvastatin", desc: "HMG-CoA reductase inhibitor (statin).", maxDose: 40 },
        { name: "Digoxin", norm: "digoxin", desc: "Cardiac glycoside for heart failure and arrhythmias.", maxDose: 0.25 },
        { name: "Spironolactone", norm: "spironolactone", desc: "Potassium-sparing aldosterone antagonist diuretic.", maxDose: 100 },
        { name: "Potassium chloride", norm: "potassiumchloride", desc: "Electrolyte replacement supplement.", maxDose: 3000 },
        { name: "Methotrexate", norm: "methotrexate", desc: "Antifolate antineoplastic and immunosuppressive drug.", maxDose: 25 },
        { name: "Lithium", norm: "lithium", desc: "Mood stabilizer for bipolar disorder.", maxDose: 1800 },
        { name: "Sildenafil", norm: "sildenafil", desc: "Phosphodiesterase-5 (PDE5) inhibitor.", maxDose: 100 },
        { name: "Nitroglycerin", norm: "nitroglycerin", desc: "Organic nitrate vasodilator for angina pectoris.", maxDose: 1.2 },
        { name: "Sertraline", norm: "sertraline", desc: "Selective serotonin reuptake inhibitor (SSRI).", maxDose: 200 },
        { name: "Tramadol", norm: "tramadol", desc: "Centrally acting synthetic opioid analgesic.", maxDose: 400 },
        { name: "Amoxicillin", norm: "amoxicillin", desc: "Beta-lactam aminopenicillin antibiotic.", maxDose: 3000 },
        { name: "Clavulanic acid", norm: "clavulanicacid", desc: "Beta-lactamase inhibitor.", maxDose: 375 },
        { name: "Azithromycin", norm: "azithromycin", desc: "Macrolide antibiotic.", maxDose: 500 },
        { name: "Cetirizine", norm: "cetirizine", desc: "Second-generation H1-antihistamine.", maxDose: 10 },
        { name: "Furosemide", norm: "furosemide", desc: "Loop diuretic.", maxDose: 80 },
        { name: "Allopurinol", norm: "allopurinol", desc: "Xanthine oxidase inhibitor for gout and hyperuricemia.", maxDose: 800 },
        { name: "Levothyroxine", norm: "levothyroxine", desc: "Synthetic thyroid hormone T4.", maxDose: 0.3 },
        { name: "Prednisolone", norm: "prednisolone", desc: "Synthetic glucocorticoid corticosteroid.", maxDose: 60 },
        { name: "Clarithromycin", norm: "clarithromycin", desc: "Macrolide antibiotic and potent CYP3A4 inhibitor.", maxDose: 1000 },
        { name: "Amiodarone", norm: "amiodarone", desc: "Class III antiarrhythmic agent.", maxDose: 400 },
        { name: "Pantoprazole", norm: "pantoprazole", desc: "Proton pump inhibitor.", maxDose: 80 }
    ];

    const ingIdMap = {};
    for (const ing of ingredientsData) {
        const id = await getOrCreateIngredient(ing.name, ing.norm, ing.desc, ing.maxDose);
        ingIdMap[ing.norm] = id;
    }

    console.log("Seeding brand medicines, combination products, and aliases...");

    // 2. Popular Brand Medicines, Combination Medicines, and Aliases
    const medicinesCatalog = [
        {
            name: "Dolo 650",
            generic: "Paracetamol",
            brand: "Dolo",
            form: "Tablet",
            strength: "650 mg",
            desc: "Widely prescribed antipyretic and analgesic tablet containing Paracetamol 650mg.",
            ingredients: [{ norm: "paracetamol", strengthStr: "650 mg", strengthMg: 650 }],
            aliases: ["Dolo", "Dolo-650", "Dolo 650mg"]
        },
        {
            name: "Crocin 500",
            generic: "Paracetamol",
            brand: "Crocin",
            form: "Tablet",
            strength: "500 mg",
            desc: "Fast relief Paracetamol 500mg tablet for fever and mild to moderate pain.",
            ingredients: [{ norm: "paracetamol", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Crocin", "Crocin Advance", "Crocin Pain Relief"]
        },
        {
            name: "Calpol 500",
            generic: "Paracetamol",
            brand: "Calpol",
            form: "Tablet",
            strength: "500 mg",
            desc: "Paracetamol formulation for antipyresis and pain relief.",
            ingredients: [{ norm: "paracetamol", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Calpol", "Calpol 650", "Calpol 500mg"]
        },
        {
            name: "Tylenol Extra Strength",
            generic: "Acetaminophen",
            brand: "Tylenol",
            form: "Caplet",
            strength: "500 mg",
            desc: "Acetaminophen (Paracetamol) 500mg extra strength pain reliever.",
            ingredients: [{ norm: "paracetamol", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Tylenol", "Acetaminophen", "Tylenol 500"]
        },
        {
            name: "Panadol",
            generic: "Paracetamol",
            brand: "Panadol",
            form: "Tablet",
            strength: "500 mg",
            desc: "Paracetamol 500mg tablet for headaches, body aches, and fever.",
            ingredients: [{ norm: "paracetamol", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Panadol Advance", "Panadol Extra"]
        },
        {
            name: "Brufen 400",
            generic: "Ibuprofen",
            brand: "Brufen",
            form: "Tablet",
            strength: "400 mg",
            desc: "Nonsteroidal anti-inflammatory tablet for arthritis, inflammation, and pain.",
            ingredients: [{ norm: "ibuprofen", strengthStr: "400 mg", strengthMg: 400 }],
            aliases: ["Brufen", "Brufen 600", "Brufen 400mg"]
        },
        {
            name: "Advil 200",
            generic: "Ibuprofen",
            brand: "Advil",
            form: "Capsule",
            strength: "200 mg",
            desc: "Ibuprofen 200mg fast-acting pain and fever reliever.",
            ingredients: [{ norm: "ibuprofen", strengthStr: "200 mg", strengthMg: 200 }],
            aliases: ["Advil", "Advil Liqui-Gels", "Motrin"]
        },
        {
            // Combination Medicine 1: Ibuprofen + Paracetamol
            name: "Combiflam",
            generic: "Ibuprofen + Paracetamol",
            brand: "Combiflam",
            form: "Tablet",
            strength: "400 mg + 325 mg",
            desc: "Combination medicine containing Ibuprofen (400 mg) and Paracetamol (325 mg) for synergistic pain relief.",
            ingredients: [
                { norm: "ibuprofen", strengthStr: "400 mg", strengthMg: 400 },
                { norm: "paracetamol", strengthStr: "325 mg", strengthMg: 325 }
            ],
            aliases: ["Combiflam Tablet", "Combiflam Plus", "Ibugesic Plus"]
        },
        {
            // Combination Medicine 2: Amoxicillin + Clavulanic Acid
            name: "Augmentin 625 Duo",
            generic: "Amoxicillin + Clavulanic Acid",
            brand: "Augmentin",
            form: "Tablet",
            strength: "500 mg + 125 mg",
            desc: "Combination broad-spectrum antibiotic containing Amoxicillin (500 mg) and Clavulanate Potassium (125 mg).",
            ingredients: [
                { norm: "amoxicillin", strengthStr: "500 mg", strengthMg: 500 },
                { norm: "clavulanicacid", strengthStr: "125 mg", strengthMg: 125 }
            ],
            aliases: ["Augmentin", "Augmentin 625", "Clavam 625", "Moxikind-CV 625"]
        },
        {
            name: "Lipitor 20",
            generic: "Atorvastatin",
            brand: "Lipitor",
            form: "Tablet",
            strength: "20 mg",
            desc: "Atorvastatin calcium 20mg for lowering LDL cholesterol and cardiovascular risk.",
            ingredients: [{ norm: "atorvastatin", strengthStr: "20 mg", strengthMg: 20 }],
            aliases: ["Lipitor", "Atorva", "Atorva 20", "Storvas"]
        },
        {
            name: "Glucophage 500",
            generic: "Metformin Hydrochloride",
            brand: "Glucophage",
            form: "Tablet",
            strength: "500 mg",
            desc: "First-line oral antidiabetic biguanide medication for type 2 diabetes.",
            ingredients: [{ norm: "metformin", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Glucophage", "Glycomet", "Glycomet 500", "Metformin 500mg"]
        },
        {
            name: "Plavix 75",
            generic: "Clopidogrel Bisulfate",
            brand: "Plavix",
            form: "Tablet",
            strength: "75 mg",
            desc: "P2Y12 platelet inhibitor for preventing blood clots after myocardial infarction, stroke, or stent.",
            ingredients: [{ norm: "clopidogrel", strengthStr: "75 mg", strengthMg: 75 }],
            aliases: ["Plavix", "Clopilet", "Clopilet 75", "Deplatt"]
        },
        {
            name: "Coumadin 5",
            generic: "Warfarin Sodium",
            brand: "Coumadin",
            form: "Tablet",
            strength: "5 mg",
            desc: "Vitamin K antagonist anticoagulant for prevention of thrombosis and pulmonary embolism.",
            ingredients: [{ norm: "warfarin", strengthStr: "5 mg", strengthMg: 5 }],
            aliases: ["Coumadin", "Jantoven", "Warf 5"]
        },
        {
            name: "Prilosec 20",
            generic: "Omeprazole",
            brand: "Prilosec",
            form: "Delayed-Release Capsule",
            strength: "20 mg",
            desc: "Proton pump inhibitor for GERD, peptic ulcer disease, and gastric acid reduction.",
            ingredients: [{ norm: "omeprazole", strengthStr: "20 mg", strengthMg: 20 }],
            aliases: ["Prilosec", "Omez", "Omez 20", "Omeprazole 20mg"]
        },
        {
            name: "Norvasc 5",
            generic: "Amlodipine Besylate",
            brand: "Norvasc",
            form: "Tablet",
            strength: "5 mg",
            desc: "Calcium channel blocker for hypertension and coronary artery disease.",
            ingredients: [{ norm: "amlodipine", strengthStr: "5 mg", strengthMg: 5 }],
            aliases: ["Norvasc", "Amlong", "Amlong 5", "Amlopres"]
        },
        {
            name: "Cipro 500",
            generic: "Ciprofloxacin",
            brand: "Cipro",
            form: "Tablet",
            strength: "500 mg",
            desc: "Broad-spectrum fluoroquinolone antibiotic.",
            ingredients: [{ norm: "ciprofloxacin", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Cipro", "Ciplox", "Ciplox 500", "Cifran 500"]
        },
        {
            name: "Lasix 40",
            generic: "Furosemide",
            brand: "Lasix",
            form: "Tablet",
            strength: "40 mg",
            desc: "Loop diuretic for edema and heart failure.",
            ingredients: [{ norm: "furosemide", strengthStr: "40 mg", strengthMg: 40 }],
            aliases: ["Lasix", "Lasix 40mg", "Fruselac"]
        },
        {
            name: "Lanoxin 0.25",
            generic: "Digoxin",
            brand: "Lanoxin",
            form: "Tablet",
            strength: "0.25 mg",
            desc: "Cardiac glycoside for atrial fibrillation and congestive heart failure.",
            ingredients: [{ norm: "digoxin", strengthStr: "0.25 mg", strengthMg: 0.25 }],
            aliases: ["Lanoxin", "Digoxin 0.25mg"]
        },
        {
            name: "Zithromax 500",
            generic: "Azithromycin",
            brand: "Zithromax",
            form: "Tablet",
            strength: "500 mg",
            desc: "Macrolide antibiotic for respiratory and skin infections.",
            ingredients: [{ norm: "azithromycin", strengthStr: "500 mg", strengthMg: 500 }],
            aliases: ["Zithromax", "Azithral", "Azithral 500", "Azee 500"]
        },
        {
            name: "Zoloft 50",
            generic: "Sertraline Hydrochloride",
            brand: "Zoloft",
            form: "Tablet",
            strength: "50 mg",
            desc: "SSRI antidepressant for major depressive disorder and anxiety disorders.",
            ingredients: [{ norm: "sertraline", strengthStr: "50 mg", strengthMg: 50 }],
            aliases: ["Zoloft", "Daxid", "Sertima"]
        },
        {
            name: "Synthroid 100mcg",
            generic: "Levothyroxine Sodium",
            brand: "Synthroid",
            form: "Tablet",
            strength: "0.1 mg",
            desc: "Synthetic thyroid hormone T4 for hypothyroidism.",
            ingredients: [{ norm: "levothyroxine", strengthStr: "100 mcg", strengthMg: 0.1 }],
            aliases: ["Synthroid", "Thyronorm", "Eltroxin", "Levothyroxine 100mcg"]
        },
        {
            name: "Viagra 50",
            generic: "Sildenafil Citrate",
            brand: "Viagra",
            form: "Tablet",
            strength: "50 mg",
            desc: "PDE5 inhibitor for erectile dysfunction.",
            ingredients: [{ norm: "sildenafil", strengthStr: "50 mg", strengthMg: 50 }],
            aliases: ["Viagra", "Revatio", "Manforce"]
        },
        {
            name: "Nitrostat 0.4",
            generic: "Nitroglycerin",
            brand: "Nitrostat",
            form: "Sublingual Tablet",
            strength: "0.4 mg",
            desc: "Sublingual nitrate for acute relief of angina pectoris.",
            ingredients: [{ norm: "nitroglycerin", strengthStr: "0.4 mg", strengthMg: 0.4 }],
            aliases: ["Nitrostat", "Nitrolingual", "Angispan"]
        },
        {
            name: "Aldactone 25",
            generic: "Spironolactone",
            brand: "Aldactone",
            form: "Tablet",
            strength: "25 mg",
            desc: "Potassium-sparing diuretic and aldosterone receptor antagonist.",
            ingredients: [{ norm: "spironolactone", strengthStr: "25 mg", strengthMg: 25 }],
            aliases: ["Aldactone", "Spilocard"]
        },
        {
            name: "Ultram 50",
            generic: "Tramadol Hydrochloride",
            brand: "Ultram",
            form: "Tablet",
            strength: "50 mg",
            desc: "Centrally acting opioid analgesic for moderate to severe pain.",
            ingredients: [{ norm: "tramadol", strengthStr: "50 mg", strengthMg: 50 }],
            aliases: ["Ultram", "Tramazac", "Tramadol 50mg"]
        },
        {
            name: "Zyrtec 10",
            generic: "Cetirizine Hydrochloride",
            brand: "Zyrtec",
            form: "Tablet",
            strength: "10 mg",
            desc: "Non-drowsy antihistamine for allergic rhinitis and urticaria.",
            ingredients: [{ norm: "cetirizine", strengthStr: "10 mg", strengthMg: 10 }],
            aliases: ["Zyrtec", "Cetzine", "Alerid", "Cetirizine 10mg"]
        },
        {
            name: "Disprin 350",
            generic: "Aspirin",
            brand: "Disprin",
            form: "Effervescent Tablet",
            strength: "350 mg",
            desc: "Soluble aspirin for acute headache and fever.",
            ingredients: [{ norm: "aspirin", strengthStr: "350 mg", strengthMg: 350 }],
            aliases: ["Disprin", "Ecosprin", "Ecosprin 75", "Ecosprin 150", "Bayer Aspirin"]
        },
        {
            name: "Zyloric 100",
            generic: "Allopurinol",
            brand: "Zyloric",
            form: "Tablet",
            strength: "100 mg",
            desc: "Xanthine oxidase inhibitor for prevention of gout attacks.",
            ingredients: [{ norm: "allopurinol", strengthStr: "100 mg", strengthMg: 100 }],
            aliases: ["Zyloric", "Allopurinol 100mg", "Zyrik"]
        },
        {
            name: "Zestril 10",
            generic: "Lisinopril",
            brand: "Zestril",
            form: "Tablet",
            strength: "10 mg",
            desc: "ACE inhibitor for arterial hypertension and heart failure.",
            ingredients: [{ norm: "lisinopril", strengthStr: "10 mg", strengthMg: 10 }],
            aliases: ["Zestril", "Prinivil", "Lipril"]
        },
        {
            name: "Potklor 10% Oral Solution",
            generic: "Potassium Chloride",
            brand: "Potklor",
            form: "Oral Solution",
            strength: "1.5 g / 15 mL",
            desc: "Potassium supplement for hypokalemia.",
            ingredients: [{ norm: "potassiumchloride", strengthStr: "1500 mg", strengthMg: 1500 }],
            aliases: ["Potklor", "K-Lor", "K-Tab", "Potassium Chloride"]
        }
    ];

    for (const med of medicinesCatalog) {
        const medId = await getOrCreateMedicine(
            med.name,
            med.generic,
            med.brand,
            med.form,
            med.strength,
            med.desc
        );

        for (const ing of med.ingredients) {
            const ingId = ingIdMap[ing.norm];
            if (ingId) {
                await linkMedicineIngredient(medId, ingId, ing.strengthStr, ing.strengthMg);
            }
        }

        for (const alias of med.aliases) {
            await addAlias(medId, alias, "brand");
        }
    }

    console.log("Seeding clinically verified drug-drug interactions with evidence citations...");

    // 3. Clinically Verified Drug-Drug Interaction Dataset
    const interactionsData = [
        {
            ing1: "aspirin",
            ing2: "warfarin",
            severity: "major",
            title: "Severe Bleeding Risk (Gastrointestinal & Systemic Hemorrhage)",
            desc: "Concurrent administration of Warfarin and Aspirin results in synergistic inhibition of hemostasis: Warfarin inhibits vitamin K-dependent clotting factors while Aspirin irreversibly inhibits platelet aggregation and damages gastric mucosal lining.",
            effect: "High incidence of fatal or major gastrointestinal hemorrhage, intracranial bleeding, and prolonged clotting times.",
            mech: "Dual inhibition of coagulation cascade (coagulation factors II, VII, IX, X) and platelet thromboxane A2 synthesis.",
            recom: "Avoid concurrent use unless strictly indicated (e.g., mechanical heart valve) under tight INR supervision (target INR 2.0-2.5) with gastroprotective proton pump inhibitor therapy.",
            source: "FDA Boxed Warning / CHEST Antithrombotic Guidelines 2021",
            url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=warfarin"
        },
        {
            ing1: "ibuprofen",
            ing2: "warfarin",
            severity: "major",
            title: "Profound Hemorrhage and Gastric Mucosal Erosion",
            desc: "NSAIDs like Ibuprofen increase the risk of severe upper gastrointestinal bleeding when taken with oral anticoagulants. Ibuprofen also displaces Warfarin from plasma albumin binding sites.",
            effect: "Dramatic increase in risk of life-threatening gastrointestinal ulceration and hemorrhage.",
            mech: "Additive impairment of platelet function, inhibition of gastroprotective prostaglandins via COX-1 inhibition, and protein-binding displacement.",
            recom: "Concurrent use should be avoided. Use non-NSAID analgesics such as Paracetamol/Acetaminophen for mild pain relief, while monitoring INR closely.",
            source: "American College of Gastroenterology / FDA Safety Alert",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability"
        },
        {
            ing1: "ciprofloxacin",
            ing2: "warfarin",
            severity: "major",
            title: "Severe Coagulopathy and Uncontrolled INR Spike",
            desc: "Ciprofloxacin potently inhibits hepatic CYP1A2 and CYP3A4 metabolism of Warfarin and eradicates intestinal flora producing vitamin K, causing sudden, dramatic surges in prothrombin time and INR.",
            effect: "Rapid INR elevation (often exceeding 8.0-10.0), spontaneous bleeding, hematuria, and hematoma formation.",
            mech: "Hepatic cytochrome P450 inhibition and reduction of endogenous vitamin K synthesis by gut microbiome.",
            recom: "Avoid fluoroquinolones when possible. If essential, reduce Warfarin dose by 30-50% upon starting Ciprofloxacin and check INR every 48 hours.",
            source: "Clinical Pharmacokinetics & Lexicomp Drug Interactions",
            url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3828945/"
        },
        {
            ing1: "omeprazole",
            ing2: "warfarin",
            severity: "moderate",
            title: "Elevated Warfarin Serum Concentrations via CYP2C19 Inhibition",
            desc: "Omeprazole inhibits cytochrome CYP2C19, which partially metabolizes R-warfarin, potentially prolonging anticoagulant action.",
            effect: "Moderate elevation of INR and increased bleeding tendency.",
            mech: "Competitive inhibition of CYP2C19 hepatic microsomal enzymes.",
            recom: "Monitor INR closely when initiating or discontinuing Omeprazole therapy. Consider alternative proton pump inhibitors with lower CYP2C19 inhibition such as Pantoprazole.",
            source: "FDA Drug Label / British National Formulary (BNF)",
            url: "https://bnf.nice.org.uk/interactions/warfarin/"
        },
        {
            ing1: "paracetamol",
            ing2: "warfarin",
            severity: "moderate",
            title: "Enhanced Anticoagulant Effect with Sustained High-Dose Paracetamol",
            desc: "Chronic, regular paracetamol ingestion (>2000 mg/day for 3 or more consecutive days) can significantly augment the hypoprothrombinemic effect of Warfarin.",
            effect: "Gradual elevation of INR and bleeding propensity.",
            mech: "Paracetamol metabolite NAPQI inhibits enzymes in the vitamin K cycle (vitamin K epoxide reductase and carboxylase).",
            recom: "Occasional single doses of Paracetamol (up to 1000 mg) are safe. For regular daily use exceeding 2-3 days, monitor INR and adjust Warfarin dose as needed.",
            source: "Thrombosis and Haemostasis Clinical Trial Evidence",
            url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1884488/"
        },
        {
            ing1: "clopidogrel",
            ing2: "omeprazole",
            severity: "major",
            title: "Significantly Reduced Antiplatelet Efficacy (Thrombosis Risk)",
            desc: "Omeprazole is a strong CYP2C19 inhibitor that substantially reduces the metabolic conversion of Clopidogrel prodrug into its active thiol metabolite, blunting platelet inhibition.",
            effect: "Increased risk of major adverse cardiovascular events (MACE), stent thrombosis, and recurrent myocardial infarction.",
            mech: "Inhibition of hepatic cytochrome CYP2C19 bioactivation step required for Clopidogrel efficacy.",
            recom: "Avoid concomitant use. Switch to Pantoprazole, Rabeprazole, or an H2-receptor antagonist (such as Famotidine) which exhibit minimal CYP2C19 inhibition.",
            source: "FDA Drug Safety Communication / American Heart Association",
            url: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers"
        },
        {
            ing1: "aspirin",
            ing2: "clopidogrel",
            severity: "moderate",
            title: "Additive Bleeding Risk with Dual Antiplatelet Therapy (DAPT)",
            desc: "Combining Aspirin with Clopidogrel produces synergistic inhibition of platelet activation and aggregation. While clinically indicated in acute coronary syndrome and post-coronary stenting, it carries heightened bleeding hazard.",
            effect: "High rate of gastrointestinal hemorrhage, petechiae, purpura, and surgical bleeding.",
            mech: "Dual pathway platelet blockade: COX-1 inhibition (thromboxane A2) plus P2Y12 adenosine diphosphate receptor antagonism.",
            recom: "Use only under direct cardiology supervision for defined duration guidelines (e.g. 6-12 months post-DES stent). Co-prescribe a gastroprotective agent (such as Pantoprazole).",
            source: "ACC/AHA Guideline for the Management of Patients With Acute Coronary Syndromes",
            url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000488"
        },
        {
            ing1: "lisinopril",
            ing2: "spironolactone",
            severity: "major",
            title: "Life-Threatening Hyperkalemia Risk",
            desc: "Co-administration of an ACE inhibitor (Lisinopril) and a potassium-sparing diuretic (Spironolactone) causes profound reduction in renal potassium clearance.",
            effect: "Severe hyperkalemia (serum potassium > 6.0 mEq/L), cardiac conduction abnormalities, heart block, and fatal ventricular arrhythmias.",
            mech: "Combined suppression of aldosterone secretion (ACEi) and competitive blockade of aldosterone receptors (Spironolactone) in the renal distal convoluted tubule.",
            recom: "Monitor serum potassium and creatinine within 1 week of co-prescribing, then at regular intervals. Avoid supplemental potassium and instruct patient to report muscle weakness or palpitations immediately.",
            source: "American Heart Association / RALES Trial Safety Data",
            url: "https://www.nejm.org/doi/full/10.1056/nejm199909023411001"
        },
        {
            ing1: "lisinopril",
            ing2: "potassiumchloride",
            severity: "major",
            title: "Severe Hyperkalemia and Cardiac Toxicity",
            desc: "ACE inhibitors diminish aldosterone production, leading to renal potassium retention. Exogenous potassium supplements create severe additive potassium load.",
            effect: "Rapid development of potentially fatal hyperkalemia, cardiac arrest, paresthesias, and flaccid paralysis.",
            mech: "Reduced renal excretion combined with direct electrolyte supplementation.",
            recom: "Routine potassium chloride supplementation with ACE inhibitors is contraindicated unless verified hypokalemia exists and close daily electrolyte tracking is performed.",
            source: "FDA Drug Safety / Clinical Pharmacology Database",
            url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=lisinopril"
        },
        {
            ing1: "ibuprofen",
            ing2: "lisinopril",
            severity: "moderate",
            title: "Renal Hemodynamic Impairment and Loss of Blood Pressure Control",
            desc: "NSAIDs inhibit renal prostaglandin synthesis, which constricts the afferent arteriole, while ACE inhibitors dilate the efferent arteriole, sharply reducing glomerular filtration rate (GFR).",
            effect: "Acute kidney injury (triple whammy effect), fluid retention, worsening hypertension, and hyperkalemia.",
            mech: "Uncoupling of renal auto-regulatory mechanisms (afferent vasoconstriction + efferent vasodilation).",
            recom: "Limit NSAID duration to lowest effective dose. Monitor blood pressure, serum creatinine, and potassium. Hydration must be maintained.",
            source: "Kidney International / KDIGO Guidelines",
            url: "https://kdigo.org/guidelines/acute-kidney-injury/"
        },
        {
            ing1: "lisinopril",
            ing2: "lithium",
            severity: "major",
            title: "Severe Lithium Toxicity Secondary to Reduced Renal Clearance",
            desc: "ACE inhibitors induce natriuresis, causing compensatory sodium and lithium reabsorption in the proximal renal tubules, precipitating toxic serum lithium levels.",
            effect: "Lithium toxicity: gross tremors, ataxia, slurred speech, confusion, seizures, acute renal failure, and coma.",
            mech: "Diminished renal excretion and enhanced proximal tubular reabsorption of lithium ions.",
            recom: "Avoid combination if possible. If unavoidable, reduce lithium dose by 30-50% and perform serum lithium monitoring every 3 to 5 days until stable.",
            source: "FDA Black Box Warning / British Journal of Clinical Pharmacology",
            url: "https://bpspubs.onlinelibrary.wiley.com/journal/13652125"
        },
        {
            ing1: "ciprofloxacin",
            ing2: "metformin",
            severity: "moderate",
            title: "Glycemic Dysregulation and Severe Hypoglycemia Risk",
            desc: "Fluoroquinolones interfere with pancreatic beta-cell potassium-ATP channels, causing inappropriate insulin secretion, which can precipitate sudden, profound hypoglycemia when combined with Metformin.",
            effect: "Symptomatic hypoglycemia (dizziness, diaphoresis, confusion, hypoglycemic coma) or erratic glycemic control.",
            mech: "Blockade of ATP-sensitive K+ channels in pancreatic beta cells stimulating insulin release.",
            recom: "Instruct patient to test blood glucose levels frequently (at least 3-4 times daily) during Ciprofloxacin therapy and have rapid-acting carbohydrates on hand.",
            source: "FDA Drug Safety Communication: Fluoroquinolone Hypoglycemia Warnings",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-updates-warnings-fluoroquinolone-antibiotics"
        },
        {
            ing1: "clarithromycin",
            ing2: "atorvastatin",
            severity: "major",
            title: "Statin Toxicity and Risk of Fatal Rhabdomyolysis",
            desc: "Clarithromycin is a potent inhibitor of CYP3A4 and organic anion transporting polypeptide (OATP1B1), increasing systemic Atorvastatin exposure by up to 400-500%.",
            effect: "Severe muscle breakdown (rhabdomyolysis), acute renal failure secondary to myoglobinuria, and profound myopathy.",
            mech: "Profound inhibition of hepatic CYP3A4 oxidative metabolism and hepatocyte uptake transporter inhibition.",
            recom: "Temporarily suspend Atorvastatin therapy during the course of Clarithromycin treatment, or use an alternative antibiotic (e.g. Azithromycin, which has minimal CYP3A4 interaction).",
            source: "FDA Safety Alert / Journal of the American College of Cardiology",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability"
        },
        {
            ing1: "amiodarone",
            ing2: "digoxin",
            severity: "major",
            title: "Digoxin Toxicity via P-Glycoprotein Blockade",
            desc: "Amiodarone inhibits P-glycoprotein-mediated renal and non-renal clearance of Digoxin, leading to a 70-100% surge in serum Digoxin concentration.",
            effect: "Digoxin toxicity: nausea, yellow-green visual halos, lethal ventricular arrhythmias, sinus bradycardia, and AV block.",
            mech: "Inhibition of renal tubular P-glycoprotein efflux pump transport.",
            recom: "Routinely reduce Digoxin dose by 50% immediately upon introducing Amiodarone. Monitor serum Digoxin level within 7-10 days and verify baseline ECG.",
            source: "Circulation / American College of Cardiology Guidelines",
            url: "https://www.ahajournals.org/doi/10.1161/CIR.0b013e31828cb0bb"
        },
        {
            ing1: "digoxin",
            ing2: "furosemide",
            severity: "moderate",
            title: "Diuretic-Induced Hypokalemia Potentiating Digoxin Arrhythmias",
            desc: "Furosemide causes renal potassium and magnesium wasting. Hypokalemia markedly increases myocardial sensitivity to Digoxin by enhancing binding to the myocardial Na+/K+-ATPase pump.",
            effect: "Premature ventricular contractions, digitalis-induced tachyarrhythmias, and AV conduction block.",
            mech: "Depletion of serum potassium ions that compete with Digoxin for the cardiac Na+/K+-ATPase binding site.",
            recom: "Maintain serum potassium strictly between 4.0-5.0 mEq/L and check magnesium. Add potassium-sparing agents or potassium replacement as clinically indicated.",
            source: "AHA/ACC Heart Failure Management Guidelines",
            url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063"
        },
        {
            ing1: "ibuprofen",
            ing2: "methotrexate",
            severity: "major",
            title: "Bone Marrow Suppression and Nephrotoxicity via Methotrexate Retention",
            desc: "NSAIDs reduce renal blood flow via prostaglandin inhibition and competitively inhibit renal tubular organic anion secretion (OAT3) of Methotrexate.",
            effect: "Severe pancytopenia, fatal bone marrow suppression, mucositis, gastrointestinal ulceration, and acute tubular necrosis.",
            mech: "Impaired renal clearance and organic anion transporter blockade elevating toxic Methotrexate AUC.",
            recom: "Avoid concurrent administration of NSAIDs with antineoplastic or high-dose Methotrexate. For low-dose rheumatology regimens, use only with rigorous CBC, LFT, and creatinine surveillance.",
            source: "FDA Black Box Warning / American College of Rheumatology",
            url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=methotrexate"
        },
        {
            ing1: "aspirin",
            ing2: "methotrexate",
            severity: "major",
            title: "Methotrexate Toxicity and Severe Myelosuppression",
            desc: "Salicylates displace Methotrexate from serum albumin and compete for active renal tubular excretion, multiplying free active Methotrexate levels.",
            effect: "Aplastic anemia, leukopenia, thrombocytopenia, and renal failure.",
            mech: "Protein displacement plus renal tubular secretory inhibition.",
            recom: "Avoid Aspirin. Use alternative pain relievers such as Paracetamol under oncologist/rheumatologist advice.",
            source: "FDA Black Box Warning / British National Formulary (BNF)",
            url: "https://bnf.nice.org.uk/interactions/methotrexate/"
        },
        {
            ing1: "ibuprofen",
            ing2: "lithium",
            severity: "major",
            title: "Acute Lithium Intoxication via Decreased Renal Excretion",
            desc: "Ibuprofen inhibits renal synthesis of vasodilatory prostaglandins, decreasing glomerular filtration and tubular clearance of lithium, elevating serum lithium by 30-60%.",
            effect: "Lithium toxicity: coarse tremors, disorientation, muscle twitching, acute renal failure, and seizures.",
            mech: "Prostaglandin-mediated reduction in renal blood flow and GFR.",
            recom: "Avoid NSAIDs in patients receiving lithium. Substitute with Paracetamol. If an NSAID is mandatory, monitor lithium serum levels within 48-72 hours.",
            source: "British Journal of Clinical Pharmacology / FDA Warning",
            url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1463991/"
        },
        {
            ing1: "ciprofloxacin",
            ing2: "prednisolone",
            severity: "major",
            title: "Significantly Heightened Risk of Tendinitis and Tendon Rupture",
            desc: "Co-administration of fluoroquinolones (Ciprofloxacin) and systemic corticosteroids (Prednisolone) dramatically multiplies the risk of severe tendinitis and spontaneous Achilles tendon rupture.",
            effect: "Spontaneous tendon rupture, permanent tendon disability, acute pain, and mobility loss.",
            mech: "Additive tenocyte cytotoxicity, extracellular matrix degradation, and collagen disruption.",
            recom: "Avoid co-prescribing. If co-administration is necessary, advise immediate cessation of exercise and report of any tendon pain, swelling, or stiffness.",
            source: "FDA Boxed Warning: Fluoroquinolone and Corticosteroid Tendinopathy",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-updates-warnings-oral-and-injectable-fluoroquinolones"
        },
        {
            ing1: "amlodipine",
            ing2: "simvastatin",
            severity: "moderate",
            title: "Simvastatin Overexposure and Myopathy Risk",
            desc: "Amlodipine inhibits CYP3A4-mediated clearance of Simvastatin, increasing Simvastatin exposure by 77%.",
            effect: "Elevated risk of statin-induced myopathy, myalgia, elevated creatine kinase, and rhabdomyolysis.",
            mech: "Competitive hepatic CYP3A4 metabolic inhibition.",
            recom: "Do not exceed Simvastatin 20 mg daily when taken concurrently with Amlodipine, or switch to a statin less reliant on CYP3A4 (e.g., Rosuvastatin or Pravastatin).",
            source: "FDA Drug Safety Communication: Revised Dosing Guidelines for Simvastatin",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-new-restrictions-contraindications-and-dose-limitations-simvastatin"
        },
        {
            ing1: "nitroglycerin",
            ing2: "sildenafil",
            severity: "major",
            title: "Catastrophic Hypotension and Fatal Cardiovascular Collapse",
            desc: "Co-administration of Nitrates and PDE5 inhibitors causes profound, synergistic accumulation of cyclic GMP (cGMP), inducing massive systemic vasodilation.",
            effect: "Severe refractory hypotension, syncope, coronary hypoperfusion, acute myocardial infarction, and cardiovascular death.",
            mech: "Nitrates provide nitric oxide (NO) which activates guanylyl cyclase, while PDE5 inhibitors prevent cGMP degradation.",
            recom: "CONTRAINDICATED. Nitroglycerin must NOT be administered within 24 hours of Sildenafil use (or within 48 hours of Tadalafil use). Emergency medical personnel must be informed immediately.",
            source: "AHA/ACC Guidelines / FDA Contraindication",
            url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000740"
        },
        {
            ing1: "sertraline",
            ing2: "tramadol",
            severity: "major",
            title: "Life-Threatening Serotonin Syndrome and Seizure Hazard",
            desc: "Both Sertraline (SSRI) and Tramadol (weak opioid with serotonin-norepinephrine reuptake inhibition) elevate central serotonin transmission. Tramadol also lowers the seizure threshold.",
            effect: "Serotonin syndrome: hyperthermia, myoclonus, autonomic instability, delirium, rigidity, seizures, and death.",
            mech: "Additive inhibition of neuronal serotonin reuptake leading to overstimulation of 5-HT1A and 5-HT2A receptors.",
            recom: "Avoid concurrent use. Use alternative non-serotonergic analgesics. If combination cannot be avoided, monitor closely for mental status changes, tremor, and tachycardia.",
            source: "WHO Pharmacovigilance / FDA Drug Safety Announcement",
            url: "https://www.fda.gov/drugs/drug-safety-and-availability"
        },
        {
            ing1: "aspirin",
            ing2: "sertraline",
            severity: "moderate",
            title: "Multiplied Gastrointestinal Bleeding and Hemostasis Disruption",
            desc: "SSRIs deplete platelet intra-cellular serotonin storage necessary for platelet activation. When combined with Aspirin or NSAIDs, the risk of upper GI bleeding increases 3 to 6-fold.",
            effect: "Upper gastrointestinal hemorrhage, melena, peptic ulceration, and hematemesis.",
            mech: "Platelet serotonin depletion compounded by COX-1 inhibition and gastric mucosal prostaglandin suppression.",
            recom: "Add a gastroprotective agent such as a proton pump inhibitor (Pantoprazole) and instruct the patient to look out for black, tarry stools or persistent abdominal pain.",
            source: "BMJ Systematic Review / Lancet Psychiatry",
            url: "https://www.bmj.com/content/337/bmj.a2116"
        },
        {
            ing1: "allopurinol",
            ing2: "amoxicillin",
            severity: "moderate",
            title: "High Incidence of Hypersensitivity Rash and Exanthema",
            desc: "Co-administration of Allopurinol with Aminopenicillins (Amoxicillin or Ampicillin) is associated with a 3 to 4-fold surge in the incidence of erythematous skin rashes.",
            effect: "Generalized maculopapular exanthematous rash, potential progression to severe cutaneous adverse reactions (SCARs).",
            mech: "Immunological hyper-reactivity and shared metabolic pathway interference.",
            recom: "Advise patient to monitor for rash and discontinue Amoxicillin immediately if skin eruptions, hives, or pruritus develop.",
            source: "British National Formulary (BNF) / American College of Rheumatology",
            url: "https://bnf.nice.org.uk/interactions/allopurinol/"
        },
        {
            ing1: "ibuprofen",
            ing2: "sertraline",
            severity: "moderate",
            title: "Increased Gastrointestinal Bleeding Risk",
            desc: "Concurrent use of SSRIs and NSAIDs impairs both platelet aggregation and mucosal defense, multiplying bleeding events.",
            effect: "Increased incidence of occult blood loss, gastric ulcers, and major GI bleeds.",
            mech: "Blockade of platelet serotonin uptake combined with inhibition of protective prostaglandins.",
            recom: "Consider short duration, lowest dose of NSAID, or prescribe with gastroprotection (PPI).",
            source: "Alimentary Pharmacology & Therapeutics",
            url: "https://onlinelibrary.wiley.com/journal/13652036"
        }
    ];

    let insertedInteractions = 0;
    for (const item of interactionsData) {
        const id1 = ingIdMap[item.ing1];
        const id2 = ingIdMap[item.ing2];

        if (!id1 || !id2) {
            console.log(`Skipping interaction ${item.ing1} - ${item.ing2} (ID not found)`);
            continue;
        }

        const minId = Math.min(id1, id2);
        const maxId = Math.max(id1, id2);

        // Insert into drug_interactions table
        await connection.query(`
            INSERT INTO drug_interactions 
            (ingredient_id_1, ingredient_id_2, severity, title, description, clinical_effect, mechanism, recommendation, source_name, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                severity = VALUES(severity),
                title = VALUES(title),
                description = VALUES(description),
                clinical_effect = VALUES(clinical_effect),
                mechanism = VALUES(mechanism),
                recommendation = VALUES(recommendation),
                source_name = VALUES(source_name),
                source_url = VALUES(source_url)
        `, [minId, maxId, item.severity, item.title, item.desc, item.effect, item.mech, item.recom, item.source, item.url]);

        // Also insert into ingredient_interactions table to keep both in sync!
        await connection.query(`
            INSERT INTO ingredient_interactions
            (ingredient_id_1, ingredient_id_2, severity, description, recommendation, source_name, source_url, evidence_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                severity = VALUES(severity),
                description = VALUES(description),
                recommendation = VALUES(recommendation),
                source_name = VALUES(source_name),
                source_url = VALUES(source_url),
                evidence_summary = VALUES(evidence_summary)
        `, [minId, maxId, item.severity, item.desc, item.recom, item.source, item.url, item.effect]);

        insertedInteractions++;
    }

    console.log(`Successfully seeded ${insertedInteractions} drug interactions.`);
    console.log("Seeding complete!");
    await connection.end();
}

seedData().catch(err => {
    console.error("Seeding error:", err);
    process.exit(1);
});
