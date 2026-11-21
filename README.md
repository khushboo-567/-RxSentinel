# RxSentinel – AI-Powered Medication Safety Checker

RxSentinel is an enterprise-grade, clinical-decision-support web application that helps patients and healthcare providers identify potentially dangerous drug interactions, allergy conflicts, duplicate ingredient exposures, and dosage-related risks between medications a patient is currently taking (**Section A: Existing Medications**) and medications they intend to take (**Section B: New Medications**).

---

## 1. System Architecture & Tech Stack

- **Frontend**: React.js 19, Vite, Tailwind CSS, Lucide Icons.
- **Backend API**: Node.js, Express.js.
- **Database**: MySQL 8.0 with InnoDB relational constraints and indexes.
- **OCR Engine**:
  - **Printed Prescriptions**: Tesseract OCR engine (via `tesseract.js` and `pytesseract`).
  - **Handwritten Prescriptions**: Microsoft TrOCR (`microsoft/trocr-base-handwritten`) with PyTorch & Hugging Face Transformers.
  - **Image Preprocessing**: OpenCV (`cv2`) with bilateral edge-preserving filtering, CLAHE contrast enhancement, and adaptive binarization.
- **Authentication**: JSON Web Tokens (JWT) and `bcryptjs` password hashing.

---

## 2. Core Functional Workflow

```
Section A: Current Medicines ──┐
                               ├──> Active Ingredients Resolution ──> Comprehensive Safety Engine ──> Medication Safety Report
Section B: New Medications  ──┤                                      - Drug Interactions (Major/Moderate/Minor)
                               │                                      - Allergy Cross-Reactivity
Allergy Profile (Optional)  ───┘                                      - Duplicate Ingredient Exposure
                                                                      - Dosage Ceiling Alerts
```

1. **User Authentication & Profiles**: Secure registration, JWT-authenticated sessions, and profile settings for age, weight, and chronic conditions.
2. **Medication Input – Two Separate Sections**:
   - **Section A (Previous/Current Medications)**: Maintained in blue/slate UI. Enter manually with live autocomplete or upload an existing prescription.
   - **Section B (New Medications)**: Maintained in vibrant teal/emerald UI. Enter manually or upload new prescriptions.
3. **Dual-Mode AI OCR Integration**:
   - Prescription Upload -> OpenCV Preprocessing -> OCR (Tesseract for printed, TrOCR for handwritten) -> Regular Expression Entity Extraction -> Database Matching -> User Verification -> Confirmation into Section A or Section B.
   - Confidence scoring (0-100%) and review status badges (*Recognized*, *Needs Review*, *Unrecognized*). Never auto-approves uncertain medicine names.
4. **Active Ingredients & Combination Medicines Resolution**:
   - Matches brands, generic names, and aliases (e.g. `Coumadin` -> `Warfarin`; `Augmentin` -> `Amoxicillin` + `Clavulanic acid`; `Combiflam` -> `Ibuprofen` + `Paracetamol`).
5. **Clinical Drug Interaction Engine**:
   - Compares unique active ingredient pairs across three dimensions:
     - Existing vs New
     - Existing vs Existing
     - New vs New
   - Categorized severities: **Major**, **Moderate**, **Minor**, **Unknown / Not Assessed**.
   - Clinically verified evidence sources (FDA Boxed Warnings, Lexicomp, British National Formulary).
6. **Additional Safety Checks**:
   - **Allergy Checking**: Matches active substances and drug classes (e.g., Penicillin cross-reactivity with Amoxicillin, Sulfa cross-reactivity) against patient allergies.
   - **Duplicate Ingredient Detection**: Identifies when two distinct brands contain the identical active ingredient (e.g., `Dolo 650` + `Crocin 500`).
   - **Dosage Checking**: Calculates cumulative daily dosage (mg/day) against validated maximum daily ceilings (`max_daily_dose_mg`). Flags missing or incomplete parameters.
7. **Comprehensive Safety Analysis Report**:
   - Executive visual indicator:
     - 🔴 **Red**: Major clinical interaction or severe allergy conflict.
     - 🟠 **Orange**: Moderate interaction or duplicate active ingredient exposure.
     - 🟢 **Green**: Informational / no documented interaction in verified database. (*Disclaimer: Not proof of absolute safety.*)
     - ⚪ **Grey**: Unknown or insufficient information / unrecognized medicine.
   - Doctor & Pharmacist Consultation Checklist.
   - Full historical persistence in database with 1-click PDF/Print export.

---

## 3. Database Schema

The database (`rxsentinel`) includes 13 properly related relational tables:

| Table | Purpose |
|---|---|
| `users` | User credentials and timestamps |
| `user_profiles` | Age, gender, weight (kg), medical conditions, emergency contact |
| `medicines` | Catalog of brand and generic medicines, standard strengths, dosage forms |
| `active_ingredients` | Normalized active pharmaceutical ingredients with `max_daily_dose_mg` |
| `medicine_ingredients` | Maps medicines to their active ingredients with strengths (supports combination drugs) |
| `medicine_aliases` | Brand names, spelling variants, and synonyms for fuzzy matching |
| `prescriptions` | Uploaded prescription metadata, OCR engine used, and extracted raw text |
| `prescription_medicines` | Extracted medicine candidates, OCR confidence, and review status |
| `user_medications` | User-specific medications partitioned by `section_type` (`existing` vs `new`) |
| `user_allergies` | Patient-reported drug allergies with reactions and severities |
| `drug_interactions` | Clinically verified interaction pairs with severities, mechanisms, and evidence sources |
| `analysis_reports` | Historical analysis report headers and raw snapshot JSON |
| `analysis_findings` | Granular findings (interactions, allergies, duplicates, dosage) linked to reports |

---

## 4. Configuration & Environment Variables

Create or edit `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=rxsentinel
DB_PORT=3306
JWT_SECRET=your_generated_jwt_secret
```

---

## 5. Installation & Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher; v24 installed)
- **MySQL Server 8.0** running locally on port 3306
- **Python** (v3.10+; virtual environment `trocr_env` already configured in `backend/`)

---

### Step 1: Initialize Database Schema & Seed Data

From the root directory:

```powershell
cd backend
# Run migration to create all 13 tables
node database/setup_database.js

# Seed active ingredients, combination medicines, aliases, and 25+ verified interactions
node database/seed_data.js
```

---

### Step 2: Start the Backend Server

```powershell
cd backend
npm install
node server.js
```

The backend API will start on: **`http://localhost:5000`**
Health check endpoint: **`http://localhost:5000/api/health`**

---

### Step 3: Start the Frontend Application

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

The React + Vite application will open on: **`http://localhost:5173`**

To produce an optimized production build:
```powershell
npm run build
```

---

### Step 4: Python OCR Service (Modular)

The modular Python OCR service is located in `backend/ai_ocr/prescription_ocr_service.py` and can be invoked directly:

```powershell
# Using the pre-configured trocr_env:
.\trocr_env\Scripts\python.exe ai_ocr\prescription_ocr_service.py <image_path> [printed|handwritten]
```

---

## 6. Verification & Automated Testing

You can run automated tests against the backend engine to verify drug-drug interaction detection:

```powershell
cd backend
node database/seed_data.js
```

### Verified Clinical Interaction Test Scenarios:
1. **Coumadin 5 (Warfarin)** in Section A + **Disprin 350 (Aspirin)** in Section B:
   - Output: 🔴 **MAJOR RISK** — Severe Gastrointestinal and Systemic Bleeding.
2. **Plavix (Clopidogrel)** in Section A + **Prilosec (Omeprazole)** in Section B:
   - Output: 🔴 **MAJOR RISK** — Blunted antiplatelet activation, increased stent thrombosis risk.
3. **Dolo 650** in Section A + **Crocin 500** in Section B:
   - Output: 🟠 **MODERATE RISK** — Duplicate Paracetamol exposure with cumulative overdose flag.
4. **Amoxicillin** in Section B with **Penicillin** allergy on file:
   - Output: 🔴 **MAJOR RISK** — Cross-reactivity anaphylaxis/hypersensitivity warning.

---

## 7. Medical Disclaimer

RxSentinel is an informational clinical screening and educational tool. **A green indicator does NOT constitute proof that a medicine combination is safe.** An interaction not identified in the available database must never automatically be deemed safe. Patients must always consult with a licensed doctor or pharmacist before starting, stopping, or altering any medication regimen.
