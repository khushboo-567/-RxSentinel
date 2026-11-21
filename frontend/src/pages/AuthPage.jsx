import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert, Lock, Mail, User, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function AuthPage({ initialMode = "login", onNavigate }) {
    const { login, register } = useAuth();
    const [mode, setMode] = useState(initialMode); // 'login' or 'register'
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email.trim() || !password) {
            setError("Please fill in all required fields.");
            return;
        }

        if (mode === "register" && !name.trim()) {
            setError("Full name is required.");
            return;
        }

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        setLoading(true);

        try {
            if (mode === "register") {
                await register(name.trim(), email.trim(), password);
            } else {
                await login(email.trim(), password);
            }
            onNavigate("dashboard");
        } catch (err) {
            setError(err.message || "Authentication failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 mx-auto flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                        <ShieldAlert className="w-7 h-7" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {mode === "login" ? "Welcome back to RxSentinel" : "Create your RxSentinel Account"}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {mode === "login"
                            ? "Sign in to access your medication profile and safety reports"
                            : "Enter your details below to begin monitoring medication interactions"}
                    </p>
                </div>

                {error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-700 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "register" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                Full Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Sarah Jenkins"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Mail className="w-4 h-4" />
                            </div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="patient@example.com"
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                            Password (8+ Characters)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock className="w-4 h-4" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 disabled:opacity-60 transition-all cursor-pointer"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Please wait...
                            </>
                        ) : (
                            <>
                                {mode === "login" ? "Sign In" : "Create Account"}
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                {/* Toggler */}
                <div className="pt-2 text-center text-xs text-slate-500">
                    {mode === "login" ? (
                        <p>
                            Don't have an account yet?{" "}
                            <button
                                onClick={() => {
                                    setMode("register");
                                    setError("");
                                }}
                                className="font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                Register now
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already registered?{" "}
                            <button
                                onClick={() => {
                                    setMode("login");
                                    setError("");
                                }}
                                className="font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                                Sign in here
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
