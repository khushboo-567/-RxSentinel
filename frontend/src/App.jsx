import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PrescriptionUploadModal from "./components/PrescriptionUploadModal";

// Pages
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import SafetyCheckWizard from "./pages/SafetyCheckWizard";
import ExistingMedsPage from "./pages/ExistingMedsPage";
import NewMedsPage from "./pages/NewMedsPage";
import AllergyPage from "./pages/AllergyPage";
import ReportViewPage from "./pages/ReportViewPage";
import PreviousReportsPage from "./pages/PreviousReportsPage";
import ProfilePage from "./pages/ProfilePage";

function AppContent() {
    const { isAuthenticated, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState("home");
    const [pageParams, setPageParams] = useState({});

    // Upload Modal State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadSectionType, setUploadSectionType] = useState("existing");

    const handleNavigate = (page, params = {}) => {
        setCurrentPage(page);
        setPageParams(params);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleOpenUploadModal = (sectionType = "existing") => {
        setUploadSectionType(sectionType);
        setUploadModalOpen(true);
    };

    const handleUploadSuccess = (targetSection) => {
        // Refresh or navigate to relevant section
        if (targetSection === "existing") {
            handleNavigate("existing-meds");
        } else {
            handleNavigate("new-meds");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-slate-600">Initializing RxSentinel...</p>
                </div>
            </div>
        );
    }

    // Determine active page
    let effectivePage = currentPage;
    if (!isAuthenticated) {
        if (!["home", "landing", "login", "register"].includes(currentPage)) {
            effectivePage = "home";
        }
    } else {
        if (["landing", "login", "register"].includes(currentPage)) {
            effectivePage = "home";
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-500 selection:text-white">
            <Navbar currentPage={effectivePage} onNavigate={handleNavigate} />

            <main className="flex-1">
                {(effectivePage === "home" || effectivePage === "landing") && (
                    <HomePage onNavigate={handleNavigate} />
                )}

                {effectivePage === "login" && (
                    <AuthPage initialMode="login" onNavigate={handleNavigate} />
                )}

                {effectivePage === "register" && (
                    <AuthPage initialMode="register" onNavigate={handleNavigate} />
                )}

                {effectivePage === "dashboard" && (
                    <DashboardPage
                        onNavigate={handleNavigate}
                        onOpenUploadModal={handleOpenUploadModal}
                    />
                )}

                {effectivePage === "safety-check" && (
                    <SafetyCheckWizard
                        onNavigate={handleNavigate}
                        onOpenUploadModal={handleOpenUploadModal}
                    />
                )}

                {effectivePage === "existing-meds" && (
                    <ExistingMedsPage onOpenUploadModal={handleOpenUploadModal} />
                )}

                {effectivePage === "new-meds" && (
                    <NewMedsPage
                        onOpenUploadModal={handleOpenUploadModal}
                        onNavigate={handleNavigate}
                    />
                )}

                {effectivePage === "allergies" && (
                    <AllergyPage />
                )}

                {effectivePage === "report-view" && (
                    <ReportViewPage
                        reportId={pageParams.reportId}
                        reportData={pageParams.reportData}
                        onNavigate={handleNavigate}
                    />
                )}

                {effectivePage === "reports" && (
                    <PreviousReportsPage onNavigate={handleNavigate} />
                )}

                {effectivePage === "profile" && (
                    <ProfilePage />
                )}
            </main>

            <Footer />

            {/* Global Prescription Upload Modal */}
            <PrescriptionUploadModal
                isOpen={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                defaultSection={uploadSectionType}
                onSuccess={handleUploadSuccess}
            />
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
