import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
    ShieldAlert,
    Pill,
    FileText,
    HeartPulse,
    User,
    LogOut,
    Menu,
    X,
    Activity,
    PlusCircle,
    History,
    Home,
    LayoutDashboard
} from "lucide-react";

export default function Navbar({ currentPage, onNavigate }) {
    const { user, isAuthenticated, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const navLinks = [
        { id: "home", label: "Home", icon: Home },
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "safety-check", label: "Safety Check", icon: HeartPulse, highlight: true },
        { id: "existing-meds", label: "Current Meds (A)", icon: Pill },
        { id: "new-meds", label: "New Meds (B)", icon: PlusCircle },
        { id: "allergies", label: "Allergies", icon: ShieldAlert },
        { id: "reports", label: "Past Reports", icon: History },
    ];

    return (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand Logo */}
                    <div
                        onClick={() => onNavigate("home")}
                        className="flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors">
                                Rx<span className="text-teal-600">Sentinel</span>
                            </span>
                            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
                                AI Safety
                            </span>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    {isAuthenticated ? (
                        <nav className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = currentPage === link.id;
                                return (
                                    <button
                                        key={link.id}
                                        onClick={() => onNavigate(link.id)}
                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                                            link.highlight
                                                ? isActive
                                                    ? "bg-teal-600 text-white shadow-sm"
                                                    : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                                                : isActive
                                                    ? "bg-slate-100 text-teal-700 font-semibold"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${link.highlight && isActive ? "text-white" : ""}`} />
                                        {link.label}
                                    </button>
                                );
                            })}
                        </nav>
                    ) : (
                        <div className="hidden md:flex items-center gap-3">
                            <button
                                onClick={() => onNavigate("login")}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-teal-700 transition-colors"
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => onNavigate("register")}
                                className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 shadow-sm transition-all"
                            >
                                Get Started Free
                            </button>
                        </div>
                    )}

                    {/* User Profile / Auth Action */}
                    {isAuthenticated && (
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                            >
                                <span className="hidden sm:block text-xs font-medium text-slate-700 max-w-[120px] truncate">
                                    {user?.name || "My Account"}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center uppercase">
                                    {user?.name ? user.name[0] : "U"}
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {userMenuOpen && (
                                <div
                                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <div className="px-4 py-2.5 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => onNavigate("profile")}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-teal-700 text-left"
                                    >
                                        <User className="w-4 h-4 text-slate-400" />
                                        Profile Settings
                                    </button>
                                    <button
                                        onClick={() => onNavigate("reports")}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-teal-700 text-left"
                                    >
                                        <History className="w-4 h-4 text-slate-400" />
                                        Past Safety Reports
                                    </button>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 text-left"
                                    >
                                        <LogOut className="w-4 h-4 text-rose-500" />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mobile Hamburger Button */}
                    <div className="flex md:hidden items-center">
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2">
                    {isAuthenticated ? (
                        <>
                            {navLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = currentPage === link.id;
                                return (
                                    <button
                                        key={link.id}
                                        onClick={() => {
                                            onNavigate(link.id);
                                            setMobileOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                                            isActive
                                                ? "bg-teal-50 text-teal-700 font-semibold"
                                                : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 text-teal-600" />
                                        {link.label}
                                    </button>
                                );
                            })}
                            <div className="border-t border-slate-100 pt-2 mt-2">
                                <button
                                    onClick={() => {
                                        onNavigate("profile");
                                        setMobileOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <User className="w-5 h-5 text-slate-400" />
                                    Profile Settings
                                </button>
                                <button
                                    onClick={() => {
                                        logout();
                                        setMobileOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50"
                                >
                                    <LogOut className="w-5 h-5 text-rose-500" />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2 pt-2">
                            <button
                                onClick={() => {
                                    onNavigate("login");
                                    setMobileOpen(false);
                                }}
                                className="w-full py-2.5 text-center text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => {
                                    onNavigate("register");
                                    setMobileOpen(false);
                                }}
                                className="w-full py-2.5 text-center text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                            >
                                Create Free Account
                            </button>
                        </div>
                    )}
                </div>
            )}
        </header>
    );
}
