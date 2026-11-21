import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem("rxsentinel_token") || "");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verify session on mount
    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        apiRequest("/auth/profile")
            .then(data => {
                if (data.success && data.user) {
                    setUser(data.user);
                } else {
                    logout();
                }
            })
            .catch(() => {
                logout();
            })
            .finally(() => {
                setLoading(false);
            });
    }, [token]);

    const login = async (email, password) => {
        const res = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        if (res.success && res.token) {
            localStorage.setItem("rxsentinel_token", res.token);
            setToken(res.token);
            setUser(res.user);
            return res.user;
        }
        throw new Error(res.message || "Login failed");
    };

    const register = async (name, email, password) => {
        const res = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });
        if (res.success && res.token) {
            localStorage.setItem("rxsentinel_token", res.token);
            setToken(res.token);
            setUser(res.user);
            return res.user;
        }
        throw new Error(res.message || "Registration failed");
    };

    const logout = () => {
        localStorage.removeItem("rxsentinel_token");
        setToken("");
        setUser(null);
    };

    const updateProfile = async (profileData) => {
        const res = await apiRequest("/auth/profile", {
            method: "PUT",
            body: JSON.stringify(profileData)
        });
        // Refresh profile
        const updated = await apiRequest("/auth/profile");
        if (updated.success) {
            setUser(updated.user);
        }
        return res;
    };

    return (
        <AuthContext.Provider value={{
            token,
            user,
            loading,
            isAuthenticated: Boolean(token && user),
            login,
            register,
            logout,
            updateProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
