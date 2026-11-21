import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const fileInputRef = useRef(null);

  // Authentication state
  const [token, setToken] = useState(() => localStorage.getItem("rxsentinel_token") || "");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(() => Boolean(localStorage.getItem("rxsentinel_token")));
  const [authMessage, setAuthMessage] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [prescriptionType, setPrescriptionType] = useState("printed");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

const [safetyAnalysis, setSafetyAnalysis] = useState({
  interactions: null,
  fda: null,
  dosage: null,
  allergies: null
});

  // Allergy Profile
  const [allergies, setAllergies] = useState([]);
  const [allergenName, setAllergenName] = useState("");
  const [allergyReaction, setAllergyReaction] = useState("");
  const [allergySeverity, setAllergySeverity] = useState("unknown");
  const [allergyLoading, setAllergyLoading] = useState(false);
  const [allergyMessage, setAllergyMessage] = useState("");
  const [showAllergyPage, setShowAllergyPage] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch("http://localhost:5000/api/auth/verify", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Session expired");
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem("rxsentinel_token");
        setToken("");
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);


  // Fetch allergies belonging to the logged-in user
useEffect(() => {
  if (!token || !user) return;

  const fetchAllergies = async () => {
    try {
      setAllergyLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/allergies",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to fetch allergies");
      }

      setAllergies(data.allergies || []);

    } catch (error) {
      setAllergyMessage(error.message);
    } finally {
      setAllergyLoading(false);
    }
  };

  fetchAllergies();
}, [token, user]);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
  ];

  // ----------------------------------------
  // LOGIN + REGISTRATION
  // ----------------------------------------

  const handleAuthentication = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const payload = authMode === "login"
        ? { email: authEmail, password: authPassword }
        : { name: authName, email: authEmail, password: authPassword };

      const response = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Authentication failed");

      // Registration is followed by login because registration does not issue a JWT.
      let loginData = data;
      if (authMode === "register") {
        const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, password: authPassword })
        });
        loginData = await loginResponse.json();
        if (!loginResponse.ok) throw new Error(loginData.message || "Registration succeeded, but login failed");
      }

      localStorage.setItem("rxsentinel_token", loginData.token);
      setToken(loginData.token);
      setUser(loginData.user);
      setAuthPassword("");
    } catch (error) {
      setAuthMessage(
        error instanceof TypeError
          ? "Cannot reach the RxSentinel server. Start the backend at http://localhost:5000 and try again."
          : error.message
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rxsentinel_token");
    setToken("");
    setUser(null);
    setOcrResult(null);
    setSelectedFile(null);
    setAuthMessage("");
  };

  // ----------------------------------------
  // FILE HANDLING
  // ----------------------------------------


  // Add a new allergy
const handleAddAllergy = async (event) => {
  event.preventDefault();

  if (!allergenName.trim()) {
    setAllergyMessage("Please enter an allergen name.");
    return;
  }

  try {
    setAllergyLoading(true);
    setAllergyMessage("");

    const response = await fetch(
      "http://localhost:5000/api/allergies",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          allergen_name: allergenName.trim(),
          reaction: allergyReaction.trim(),
          severity: allergySeverity
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to add allergy");
    }

    setAllergies((previous) => [
      ...previous,
      {
        id: data.allergyId,
        allergen_name: allergenName.trim(),
        reaction: allergyReaction.trim(),
        severity: allergySeverity
      }
    ]);

    setAllergenName("");
    setAllergyReaction("");
    setAllergySeverity("unknown");

    setAllergyMessage("Allergy added successfully.");

  } catch (error) {
    setAllergyMessage(error.message);
  } finally {
    setAllergyLoading(false);
  }
};


// Delete an allergy
const handleDeleteAllergy = async (allergyId) => {
  if (!window.confirm("Are you sure you want to delete this allergy?")) {
    return;
  }

  try {
    setAllergyLoading(true);
    setAllergyMessage("");

    const response = await fetch(
      `http://localhost:5000/api/allergies/${allergyId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to delete allergy");
    }

    setAllergies((previous) =>
      previous.filter((allergy) => allergy.id !== allergyId)
    );

    setAllergyMessage("Allergy deleted successfully.");

  } catch (error) {
    setAllergyMessage(error.message);
  } finally {
    setAllergyLoading(false);
  }
};

  const handleFile = (file) => {
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG or PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10 MB.");
      return;
    }

    setSelectedFile(file);
    setOcrResult(null);
  };

  const handleFileChange = (event) => {
    handleFile(event.target.files[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    handleFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setOcrResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  // ----------------------------------------
  // UPLOAD + OCR
  // ----------------------------------------

const startAnalysis = async () => {
  if (!token || !user) {
    setAuthMessage("Please log in before uploading a prescription.");
    return;
  }

  if (!selectedFile) {
    alert("Please upload a prescription first.");
    return;
  }

  setIsUploading(true);
  setOcrResult(null);

  setSafetyAnalysis({
    interactions: null,
    fda: null,
    dosage: null,
    allergies: null
  });

  try {
    const formData = new FormData();
    formData.append("prescription", selectedFile);
    formData.append("prescriptionType", prescriptionType);

    // Upload prescription and extract medicines
    const response = await fetch(
      "http://localhost:5000/api/prescriptions/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Upload failed");
    }

    setOcrResult(data);
    console.log("FULL OCR RESPONSE:", data);
    console.log("RESPONSE KEYS:", Object.keys(data));
    console.log("RAW OCR TEXT:", data.extractedText);
console.log("OCR CONFIDENCE:", data.ocrConfidence);

  console.table(data.detectedMedicines);

    const prescriptionId = data.prescriptionId;

    if (!prescriptionId) {
      throw new Error("Prescription ID was not returned.");
    }

    // Run all four analyses
    const endpoints = {
      interactions: "interactions",
      fda: "fda-interactions",
      dosage: "dosage-analysis",
      allergies: "allergy-analysis"
    };

    const results = await Promise.all(
      Object.entries(endpoints).map(async ([key, endpoint]) => {
        try {
          const res = await fetch(
            `http://localhost:5000/api/prescriptions/${prescriptionId}/${endpoint}`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          const result = await res.json();

          if (!res.ok) {
            throw new Error(result.message || "Analysis failed");
          }

          return [
            key,
            {
              data: key === "allergies" ? result : result.result,
              error: null
            }
          ];

        } catch (error) {
          return [
            key,
            {
              data: null,
              error: error.message
            }
          ];
        }
      })
    );

    setSafetyAnalysis(Object.fromEntries(results));

    console.log("Safety Analysis:", Object.fromEntries(results));

  } catch (error) {
    console.error("Prescription Analysis Error:", error);
    alert("Analysis failed: " + error.message);

  } finally {
    setIsUploading(false);
  }
};

  // ----------------------------------------
  // NAVIGATION
  // ----------------------------------------

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };


  // ----------------------------------------
  // LOGIN SCREEN: show the main website only after login
  // ----------------------------------------

  if (authChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f8f7", color: "#173b35", fontFamily: "inherit" }}>
        Checking your session...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "linear-gradient(135deg, #eaf5f1, #f7faf9)" }}>
        <div style={{ width: "100%", maxWidth: "440px", padding: "36px", borderRadius: "20px", background: "#fff", boxShadow: "0 18px 55px rgba(20, 70, 58, 0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "26px" }}>
            <div style={{ width: "48px", height: "48px", display: "grid", placeItems: "center", borderRadius: "14px", background: "#e1f1eb", color: "#176b55", fontSize: "27px" }}>✚</div>
            <div>
              <div style={{ fontSize: "25px", fontWeight: 800, color: "#173b35" }}>RxSentinel</div>
              <div style={{ fontSize: "12px", color: "#668078" }}>Prescription Safety Intelligence</div>
            </div>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "27px", color: "#173b35" }}>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p style={{ margin: "0 0 24px", color: "#6b7e78", lineHeight: 1.5 }}>{authMode === "login" ? "Log in to access your prescription analysis dashboard." : "Register to securely save and analyze your prescriptions."}</p>
          <form onSubmit={handleAuthentication} style={{ display: "grid", gap: "14px" }}>
            {authMode === "register" && <input style={authInputStyle} type="text" placeholder="Full name" value={authName} onChange={(e) => setAuthName(e.target.value)} required minLength={2} />}
            <input style={authInputStyle} type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
            <input style={authInputStyle} type="password" placeholder="Password (minimum 8 characters)" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={8} />
            <button type="submit" disabled={authLoading} style={{ padding: "14px", border: 0, borderRadius: "10px", background: "#176b55", color: "white", fontWeight: 700, cursor: "pointer", opacity: authLoading ? 0.7 : 1 }}>
              {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}
            </button>
          </form>
          {authMessage && <div role="alert" style={{ marginTop: "16px", padding: "12px", borderRadius: "9px", background: "#fff1ef", color: "#a13b30", fontSize: "14px", lineHeight: 1.5 }}>{authMessage}</div>}
          <div style={{ marginTop: "22px", textAlign: "center", color: "#647871", fontSize: "14px" }}>
            {authMode === "login" ? "New to RxSentinel? " : "Already have an account? "}
            <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthMessage(""); }} style={{ border: 0, background: "none", color: "#176b55", fontWeight: 700, cursor: "pointer" }}>
              {authMode === "login" ? "Create account" : "Login instead"}
            </button>
          </div>
          <p style={{ margin: "24px 0 0", textAlign: "center", color: "#8a9a94", fontSize: "11px" }}>Academic project · Not a substitute for professional medical advice</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // UI: authenticated users see the complete website
  // ----------------------------------------

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      {!showAllergyPage && (
  <nav className="navbar">

        <div
          className="brand"
          onClick={() => scrollToSection("dashboard")}
        >
          <div className="brand-icon">✚</div>

          <div>
            <div className="brand-name">
              RxSentinel
            </div>

            <div className="brand-tagline">
              Prescription Safety Intelligence
            </div>
          </div>
        </div>


        <div className="nav-links">

          <button
            onClick={() => scrollToSection("dashboard")}
          >
            Dashboard
          </button>

          <button
            onClick={() => scrollToSection("how-it-works")}
          >
            How It Works
          </button>

          <button
            onClick={() => scrollToSection("about")}
          >
            About
          </button>

          <button
  className="allergy-nav-button"
  onClick={() => {
    setAllergyMessage("");
    setShowAllergyPage(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }}
>
  <span>✚</span>
  Manage Allergies
</button>

        </div>


        {user ? (
          <button className="profile-button" onClick={handleLogout}>
            {user.email} · Logout
          </button>
        ) : (
          <button
            className="profile-button"
            onClick={() => document.getElementById("account-access")?.scrollIntoView({ behavior: "smooth" })}
          >
            Login / Register
          </button>
        )}

      </nav>
      )}


      {/* ================= MAIN ================= */}

      <main>

     {showAllergyPage ? (
  <section className="allergy-page">

    <div className="allergy-page-header">

      <button
        className="back-dashboard-button"
        onClick={() => {
          setShowAllergyPage(false);
          setAllergyMessage("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        ← Back to Dashboard
      </button>

      <div className="allergy-heading">
        <span className="allergy-label">PERSONAL HEALTH PROFILE</span>
        <h1>Allergy Management</h1>
        <p>
          Keep your allergy information updated to help identify
          potential medication-related allergy concerns.
        </p>
      </div>

    </div>

    <form onSubmit={handleAddAllergy} className="allergy-form">

      <div className="form-heading">
        <div className="form-icon">✚</div>
        <div>
          <h2>Add a New Allergy</h2>
          <p>Enter your allergy details below.</p>
        </div>
      </div>

      <div className="allergy-input-group">
        <label>Allergen Name *</label>
        <input
          type="text"
          placeholder="e.g. Penicillin"
          value={allergenName}
          onChange={(e) => setAllergenName(e.target.value)}
          required
        />
      </div>

      <div className="allergy-input-group">
        <label>Reaction</label>
        <input
          type="text"
          placeholder="e.g. Skin rash, itching"
          value={allergyReaction}
          onChange={(e) => setAllergyReaction(e.target.value)}
        />
      </div>

      <div className="allergy-input-group">
        <label>Severity</label>
        <select
          value={allergySeverity}
          onChange={(e) => setAllergySeverity(e.target.value)}
        >
          <option value="unknown">Severity unknown</option>
          <option value="mild">Mild</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
        </select>
      </div>

      <button
        type="submit"
        className="add-allergy-button"
        disabled={allergyLoading}
      >
        {allergyLoading ? "Please wait..." : "+ Add Allergy"}
      </button>

    </form>

    {allergyMessage && (
      <div className="allergy-message">
        {allergyMessage}
      </div>
    )}

    <div className="allergy-list">

      <div className="allergy-list-heading">
        <div>
          <h2>Your Saved Allergies</h2>
          <p>Allergies associated with your account.</p>
        </div>

        <span className="allergy-count">
          {allergies.length} Saved
        </span>
      </div>

      {allergyLoading && allergies.length === 0 ? (
        <p>Loading allergies...</p>
      ) : allergies.length === 0 ? (
        <div className="empty-allergies">
          <span>✚</span>
          <h3>No allergies added yet</h3>
          <p>Your saved allergies will appear here.</p>
        </div>
      ) : (
        allergies.map((allergy) => (
          <div className="allergy-card" key={allergy.id}>

            <div className="allergy-card-icon">✚</div>

            <div className="allergy-card-details">
              <h3>{allergy.allergen_name}</h3>
              <p>
                Reaction: {allergy.reaction || "Not specified"}
              </p>
              <span className={`severity-badge ${allergy.severity || "unknown"}`}>
                {allergy.severity || "Unknown"} severity
              </span>
            </div>

            <button
              type="button"
              className="delete-allergy-button"
              onClick={() => handleDeleteAllergy(allergy.id)}
              disabled={allergyLoading}
            >
              Delete
            </button>

          </div>
        ))
      )}

    </div>

    <div className="allergy-disclaimer">
      <strong>Important Safety Information</strong>
      <p>
        RxSentinel checks exact medicine and allergen-name matches.
        A missing match does not guarantee that a medicine is safe.
        Always consult a qualified healthcare professional.
      </p>
    </div>

  </section>
) : (
  <>

        {/* ================= HERO ================= */}

        <section
          id="dashboard"
          className="hero-section"
        >

          <div className="hero-content">

            <div className="status-badge">

              <span className="status-dot"></span>

              AI-POWERED PRESCRIPTION ANALYSIS

            </div>


            <h1>

              Understand your prescription.

              <span>
                {" "}Stay medication-safe.
              </span>

            </h1>


            <p className="hero-description">

              RxSentinel analyzes prescription documents
              to extract medicine information and identify
              potential medication safety concerns.

            </p>

          </div>


          {/* ================= UPLOAD CARD ================= */}

          <div className="upload-card">

            <div className="upload-header">

              <div className="upload-icon">
                ↑
              </div>

              <div>

                <h2>
                  Upload Prescription
                </h2>

                <p>
                  Upload a clear image or PDF of your prescription.
                </p>

              </div>

            </div>


            {/* PRESCRIPTION TYPE SELECTOR */}

            <div style={{
              marginBottom: "18px",
              padding: "16px",
              background: "#f5faf8",
              border: "1px solid #dcebe5",
              borderRadius: "12px"
            }}>
              <label
                htmlFor="prescriptionType"
                style={{
                  display: "block",
                  marginBottom: "9px",
                  color: "#173b35",
                  fontWeight: 700,
                  fontSize: "14px"
                }}
              >
                Select Prescription Type
              </label>

              <select
                id="prescriptionType"
                value={prescriptionType}
                onChange={(event) => setPrescriptionType(event.target.value)}
                disabled={isUploading}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #cbdcd5",
                  borderRadius: "8px",
                  background: "white",
                  color: "#173b35",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <option value="printed">Printed Prescription (Tesseract OCR)</option>
                <option value="handwritten">Handwritten Prescription (TrOCR)</option>
              </select>

              <p style={{
                margin: "8px 0 0",
                color: "#71827b",
                fontSize: "12px"
              }}>
                Choose the type that matches your prescription before uploading.
              </p>
            </div>

            {/* DROP ZONE */}

            <div
              className={`drop-zone ${
                isDragging ? "dragging" : ""
              }`}

              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}

              onDragLeave={() => {
                setIsDragging(false);
              }}

              onDrop={handleDrop}

              onClick={() =>
                fileInputRef.current?.click()
              }
            >

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                hidden
              />


              {!selectedFile ? (

                <>

                  <div className="drop-icon">
                    ↑
                  </div>

                  <h3>
                    Drag & drop your prescription
                  </h3>

                  <p>
                    or click here to browse files
                  </p>

                  <span className="file-info">
                    JPG, PNG or PDF • Maximum 10 MB
                  </span>

                </>

              ) : (

                <div className="selected-file">

                  <div className="file-icon">
                    📄
                  </div>


                  <div className="file-details">

                    <strong>
                      {selectedFile.name}
                    </strong>

                    <span>
                      {
                        (
                          selectedFile.size /
                          1024 /
                          1024
                        ).toFixed(2)
                      } MB
                    </span>

                  </div>


                  <button
                    className="remove-file"

                    onClick={(event) => {
                      event.stopPropagation();
                      removeFile();
                    }}
                  >
                    ×
                  </button>

                </div>

              )}

            </div>


            {/* ANALYZE BUTTON */}

            <button
              className={`analyze-button ${
                !selectedFile || isUploading
                  ? "disabled"
                  : ""
              }`}

              onClick={startAnalysis}

              disabled={!selectedFile || isUploading}
            >

              {isUploading
                ? "Analyzing Prescription..."
                : ocrResult
                ? "Analyze Again →"
                : "Analyze Prescription →"}

            </button>


            {/* ================= ANALYSIS RESULTS ================= */}

            {ocrResult && (
            <div className="analysis-results">

  {/* COMPACT PRESCRIPTION RESULTS */}

  <div className="detected-medicines compact-medicines">

    <div className="prescription-success">
      <span className="success-icon">✓</span>
      <div>
        <strong>Prescription analyzed successfully</strong>
        <p>
          Prescription ID: {ocrResult.prescriptionId ?? "Not available"}
        </p>
      </div>
    </div>

    <div className="medicines-heading">
      <strong>Detected Medicines</strong>
      <span>
        {Array.isArray(ocrResult.detectedMedicines)
          ? `${ocrResult.detectedMedicines.length} found`
          : "Results unavailable"}
      </span>
    </div>

    {Array.isArray(ocrResult.detectedMedicines) &&
    ocrResult.detectedMedicines.length > 0 ? (

      <div className="compact-medicine-list">

        {ocrResult.detectedMedicines.map((medicine, index) => {

          const medicineName = typeof medicine === "string"
            ? medicine
            : medicine.name ||
              medicine.generic_name ||
              medicine.originalOcrName ||
              medicine.original_ocr_name ||
              `Medicine ${index + 1}`;

          return (
            <div
              key={medicine.id ?? `${medicineName}-${index}`}
              className="compact-medicine-card"
            >
              <span className="medicine-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <strong>{medicineName}</strong>

                {typeof medicine === "object" && medicine.generic_name && (
                  <p>Generic: {medicine.generic_name}</p>
                )}
              </div>

            </div>
          );
        })}

      </div>

    ) : (
      <p>No medicines were identified in this prescription.</p>
    )}

  </div>

                {/* PRESCRIPTION SAFETY REPORT */}

<div className="safety-report">

<div className="report-header">
  <h2>Prescription Safety Report</h2>

  <button
    className="print-report-button"
    onClick={() => window.print()}
  >
    ↓ Download Report
  </button>
</div>

{isUploading && (
  <div className="analysis-progress">
    <div className="progress-spinner"></div>

    <div>
      <strong>Analyzing your prescription...</strong>
      <p>
        Checking drug interactions, FDA references,
        dosage information and allergies.
      </p>
    </div>
  </div>
)}

  {(() => {
  const interactions = safetyAnalysis.interactions?.data?.interactions || [];
  const fda = safetyAnalysis.fda?.data?.findings || [];
  const dosage = safetyAnalysis.dosage?.data?.results || [];
  const allergies = safetyAnalysis.allergies?.data?.potentialMatches || [];

  const incompleteDosages = dosage.filter(
    item => item.status === "incomplete_information"
  ).length;

  const medicineCount = ocrResult?.detectedMedicines?.length || 0;

  return (
    <div className="safety-summary">

      <div className="summary-heading">
        <span>ANALYSIS OVERVIEW</span>
        <h3>Prescription at a glance</h3>
      </div>

      <div className="summary-grid">

        <div className="summary-card">
          <span>Medicines detected</span>
          <strong>{medicineCount}</strong>
        </div>

        <div className="summary-card">
          <span>Drug interactions</span>
          <strong>{interactions.length}</strong>
        </div>

        <div className="summary-card">
          <span>FDA findings</span>
          <strong>{fda.length}</strong>
        </div>

        <div className="summary-card">
          <span>Dosage incomplete</span>
          <strong>{incompleteDosages}</strong>
        </div>

        <div className="summary-card">
          <span>Potential allergy matches</span>
          <strong>{allergies.length}</strong>
        </div>

      </div>
    </div>
  );
})()}

  {/* 1. Drug Interactions */}
{/* 1. Drug Interactions */}

<div className="safety-section">
  <h3>1. Drug Interaction Analysis</h3>

  {safetyAnalysis.interactions?.error ? (

    <p className="analysis-error">
      Analysis unavailable: {safetyAnalysis.interactions.error}
    </p>

  ) : safetyAnalysis.interactions?.data ? (

    <>
      <p>
        Interactions found:{" "}
        <strong>
          {safetyAnalysis.interactions.data.interactionsFound}
        </strong>
      </p>

      {safetyAnalysis.interactions.data.interactions?.length > 0 ? (

        safetyAnalysis.interactions.data.interactions.map((item, i) => (
          <div className="safety-item" key={i}>
            <strong>{item.medicine1} + {item.medicine2}</strong>
            <p>
              Severity:{" "}
              <span className={`risk-badge ${String(item.severity || "unknown").toLowerCase()}`}>
                {item.severity || "Unknown"}
              </span>
            </p>
            <p>{item.description}</p>
            <p>{item.recommendation}</p>
          </div>
        ))

      ) : (
        <p>No matching interactions were found in the available reference data.</p>
      )}

      {safetyAnalysis.interactions.data.unassessedPairs?.length > 0 && (
        <p className="safety-note">
          {safetyAnalysis.interactions.data.unassessedPairs.length} medicine pair(s)
          could not be fully assessed. No detected interaction does not establish safety.
        </p>
      )}
    </>

  ) : (
    <p>Analysis is pending or unavailable.</p>
  )}
</div>

  {/* 2. FDA */}
 {/* 2. FDA DRUG LABEL ANALYSIS */}

<div className="safety-section">
  <h3>2. FDA Drug Label Analysis</h3>

  {safetyAnalysis.fda?.error ? (

    <p className="analysis-error">
      FDA analysis unavailable: {safetyAnalysis.fda.error}
    </p>

  ) : safetyAnalysis.fda?.data ? (

    <>
      <p>
        Matched findings:{" "}
        <strong>
          {safetyAnalysis.fda.data.findings?.length ?? 0}
        </strong>
      </p>

      {safetyAnalysis.fda.data.findings?.length > 0 ? (

        safetyAnalysis.fda.data.findings.map((item, i) => (
          <div className="safety-item" key={i}>
            <strong>
              {item.sourceMedicine} – {item.interactingMedicine}
            </strong>

            <p>{item.findingType?.replaceAll("_", " ")}</p>
            <p>{item.description}</p>
            <p>{item.recommendation}</p>

            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                View Reference
              </a>
            )}
          </div>
        ))

      ) : (
        <p>No matching FDA label findings were identified in the available reference data.</p>
      )}

      {safetyAnalysis.fda.data.unmatchedLabelFindings?.length > 0 && (

        <div className="safety-note">
          <strong>Unmatched label references</strong>

          <p>
            {safetyAnalysis.fda.data.unmatchedLabelFindings.length}
            {" "}reference(s) could not be matched to the available records.
            These have not been treated as confirmed interactions.
          </p>

          {safetyAnalysis.fda.data.unmatchedLabelFindings.map((item, i) => (
            <p key={i}>
              {item.sourceMedicine}: {item.mentionedSubstance}
            </p>
          ))}
        </div>
      )}
    </>

  ) : (
    <p>FDA analysis is pending or unavailable.</p>
  )}
</div>

  {/* 3. Dosage */}
 {/* 3. DOSAGE INFORMATION ANALYSIS */}

<div className="safety-section">
  <h3>3. Dosage Information Analysis</h3>

  {safetyAnalysis.dosage?.error ? (

    <p className="analysis-error">
      Dosage analysis unavailable: {safetyAnalysis.dosage.error}
    </p>

  ) : safetyAnalysis.dosage?.data ? (

    <>
      {safetyAnalysis.dosage.data.results?.length > 0 ? (

        safetyAnalysis.dosage.data.results.map((item, i) => {

          const isIncomplete =
            item.status?.toLowerCase() === "incomplete_information";

          return (
            <div className="safety-item" key={i}>

              <strong>{item.medicine}</strong>

              <p>
                Strength: {item.extractedStrength || "Not specified"}
              </p>

              <p>
                Frequency: {item.frequency || "Not specified"}
              </p>

              <p>
                Duration: {item.duration || "Not specified"}
              </p>

              <p>
                Information status:{" "}
                <span className={`risk-badge ${isIncomplete ? "moderate" : "complete"}`}>
                  {item.status?.replaceAll("_", " ") || "Not available"}
                </span>
              </p>

              {item.missingInformation?.length > 0 && (
                <div className="dosage-warning">
                  <strong>Missing information</strong>

                  {item.missingInformation.map((info, j) => (
                    <p key={j}>• {info}</p>
                  ))}
                </div>
              )}

              {item.observations?.length > 0 && (
                <div className="dosage-observations">
                  <strong>Observations</strong>

                  {item.observations.map((info, j) => (
                    <p key={j}>• {info}</p>
                  ))}
                </div>
              )}

            </div>
          );
        })

      ) : (
        <p>No dosage information results were returned.</p>
      )}

      <p className="safety-note">
        This analysis checks prescription information completeness.
        It does not verify whether a dosage is clinically appropriate
        or safe for the patient.
      </p>
    </>

  ) : (
    <p>Dosage analysis is pending or unavailable.</p>
  )}
</div>

  {/* 4. Allergies */}
  {/* 4. ALLERGY ANALYSIS */}

<div className="safety-section">
  <h3>4. Allergy Analysis</h3>

  {safetyAnalysis.allergies?.error ? (

    <p className="analysis-error">
      Allergy analysis unavailable: {safetyAnalysis.allergies.error}
    </p>

  ) : safetyAnalysis.allergies?.data ? (

    <>
      <p>
        Medicines checked:{" "}
        <strong>
          {safetyAnalysis.allergies.data.totalMedicinesChecked ?? 0}
        </strong>
      </p>

      <p>
        Allergies on profile:{" "}
        <strong>
          {safetyAnalysis.allergies.data.totalAllergiesOnProfile ?? 0}
        </strong>
      </p>

      {safetyAnalysis.allergies.data.potentialMatches?.length > 0 ? (

        safetyAnalysis.allergies.data.potentialMatches.map((item, i) => (
          <div className="safety-item" key={i}>

            <strong>{item.medicine}</strong>

            {item.potentialAllergyMatches?.map((match, j) => (
              <div className="dosage-warning" key={j}>
                <strong>Potential allergy match: {match.allergen_name}</strong>

                <p>
                  Reaction: {match.reaction || "Not specified"}
                </p>

                <p>
                  Severity: {match.severity || "Unknown"}
                </p>
              </div>
            ))}

          </div>
        ))

      ) : (
        <p>
          No exact allergy matches were found in the saved allergy profile.
        </p>
      )}

      <p className="safety-note">
        {safetyAnalysis.allergies.data.assessmentNote}
      </p>
    </>

  ) : (
    <p>Allergy analysis is pending or unavailable.</p>
  )}
</div>

  <div className="safety-disclaimer">
    <strong>Important Medical Disclaimer</strong>
    <p>
      No detected match does not guarantee medication safety.
      RxSentinel does not replace professional medical advice.
    </p>
  </div>

</div>
              </div>
            )}

          </div>


          {/* ================= FEATURES ================= */}

          <div className="feature-grid">

            <FeatureCard
              icon="⌕"
              title="OCR Extraction"
              text="Extract prescription information automatically from uploaded documents."
            />

            <FeatureCard
              icon="💊"
              title="Medicine Analysis"
              text="Identify medicines and organize prescription information."
            />

            <FeatureCard
              icon="⚕"
              title="Safety Insights"
              text="Analyze potential interactions, dosage concerns and safety information."
            />

          </div>

        </section>


        {/* ================= HOW IT WORKS ================= */}

        <section
          id="how-it-works"
          className="section"
        >

          <div className="section-heading">

            <span>
              HOW IT WORKS
            </span>

            <h2>
              From prescription to safety insights
            </h2>

            <p>
              RxSentinel follows a structured analysis
              workflow to turn an uploaded prescription
              into understandable safety information.
            </p>

          </div>


          <div className="workflow">

            <WorkflowStep
              number="01"
              title="Upload"
              text="Upload a prescription image or PDF."
            />

            <div className="workflow-line"></div>

            <WorkflowStep
              number="02"
              title="Extract"
              text="OCR extracts the prescription text."
            />

            <div className="workflow-line"></div>

            <WorkflowStep
              number="03"
              title="Analyze"
              text="Medicines and safety factors are analyzed."
            />

            <div className="workflow-line"></div>

            <WorkflowStep
              number="04"
              title="Report"
              text="Receive an understandable safety report."
            />

          </div>

        </section>

       
        {/* ================= ABOUT ================= */}

        <section
          id="about"
          className="about-section"
        >

          <div className="about-content">

            <div>

              <span className="section-label">
                ABOUT RXSENTINEL
              </span>

              <h2>
                Making prescription information
                easier to understand.
              </h2>

            </div>


            <div>

              <p>
                RxSentinel is an AI-assisted prescription
                analysis platform designed to help users
                understand information contained in their
                prescriptions.
              </p>

              <p>
                The system combines OCR, structured medicine
                data and intelligent analysis to present
                prescription information in a clear and
                traceable format.
              </p>


              <div className="important-note">

                <strong>
                  Important:
                </strong>

                <span>
                  RxSentinel is designed as a decision-support
                  and information tool. It does not replace
                  a qualified healthcare professional.
                </span>

              </div>

            </div>

          </div>

        </section>

          </>
)}

      </main>


      {/* ================= FOOTER ================= */}

      {!showAllergyPage && (
  <footer className="footer">

        <div className="footer-main">

          <div>

            <div className="footer-brand">

              <div className="brand-icon">
                ✚
              </div>

              RxSentinel

            </div>


            <p>
              AI-assisted prescription analysis
              and medication safety insights.
            </p>

          </div>


          <div className="footer-links">

            <div>

              <h4>
                Platform
              </h4>

              <button
                onClick={() =>
                  scrollToSection("dashboard")
                }
              >
                Dashboard
              </button>

              <button
                onClick={() =>
                  scrollToSection("how-it-works")
                }
              >
                How It Works
              </button>

            </div>


            <div>

              <h4>
                Information
              </h4>

              <button
                onClick={() =>
                  scrollToSection("about")
                }

              >
                About
              </button>

              <button
                onClick={() =>
                  alert(
                    "Privacy information will be added later."
                  )
                }
              >
                Privacy
              </button>

            </div>

          </div>

        </div>


        <div className="footer-bottom">

          <span>
            © 2026 RxSentinel. Academic project.
          </span>

          <span>
            Built for safer prescription understanding.
          </span>

        </div>

      </footer>

      )}

    </div>
  );
}


const authInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  border: "1px solid #d7e3df",
  borderRadius: "10px",
  outlineColor: "#176b55",
  fontSize: "14px"
};

/* =====================================================
   FEATURE CARD
===================================================== */

function FeatureCard({
  icon,
  title,
  text,
}) {
  return (
    <div className="feature-card">

      <div className="feature-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </div>
  );
}


/* =====================================================
   WORKFLOW STEP
===================================================== */

function WorkflowStep({
  number,
  title,
  text,
}) {
  return (
    <div className="workflow-step">

      <div className="workflow-number">
        {number}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </div>
  );
}


export default App;