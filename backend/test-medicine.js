const { findMedicinesInText } = require("./services/medicineService");

const text = `
Patient Prescription

Paracetamol 500 mg
Cetirizine 10 mg
Take twice daily for 5 days
`;

findMedicinesInText(text)
    .then((medicines) => {
        console.log("Medicines Found:");
        console.log(medicines);
    })
    .catch((error) => {
        console.error("Medicine Extraction Error:", error);
    });