const db = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ========================================
// USER REGISTRATION
// ========================================
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check existing user
        const [existingUsers] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Save user
        const [result] = await db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name.trim(), normalizedEmail, hashedPassword]
        );

        const userId = result.insertId;

        // Initialize user profile
        await db.query(
            "INSERT INTO user_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
            [userId]
        );

        const token = jwt.sign(
            {
                userId,
                email: normalizedEmail,
                name: name.trim()
            },
            process.env.JWT_SECRET || "default_jwt_secret_rxsentinel",
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: userId,
                name: name.trim(),
                email: normalizedEmail
            }
        });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({
            success: false,
            message: "Registration failed: " + error.message
        });
    }
};

// ========================================
// USER LOGIN
// ========================================
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name
            },
            process.env.JWT_SECRET || "default_jwt_secret_rxsentinel",
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

// ========================================
// GET USER PROFILE
// ========================================
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [users] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at,
                    p.age, p.gender, p.weight_kg, p.medical_conditions, p.emergency_contact, p.notes
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
             WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve profile"
        });
    }
};

// ========================================
// UPDATE USER PROFILE
// ========================================
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, age, gender, weight_kg, medical_conditions, emergency_contact, notes } = req.body;

        if (name && name.trim()) {
            await db.query("UPDATE users SET name = ? WHERE id = ?", [name.trim(), userId]);
        }

        await db.query(
            `INSERT INTO user_profiles (user_id, age, gender, weight_kg, medical_conditions, emergency_contact, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                age = VALUES(age),
                gender = VALUES(gender),
                weight_kg = VALUES(weight_kg),
                medical_conditions = VALUES(medical_conditions),
                emergency_contact = VALUES(emergency_contact),
                notes = VALUES(notes)`,
            [
                userId,
                age ? Number(age) : null,
                gender || null,
                weight_kg ? Number(weight_kg) : null,
                medical_conditions || null,
                emergency_contact || null,
                notes || null
            ]
        );

        res.json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile"
        });
    }
};

// ========================================
// CHANGE PASSWORD
// ========================================
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must contain at least 8 characters"
            });
        }

        const [users] = await db.query("SELECT password FROM users WHERE id = ?", [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const match = await bcrypt.compare(currentPassword, users[0].password);
        if (!match) {
            return res.status(401).json({ success: false, message: "Incorrect current password" });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, userId]);

        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to change password"
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    changePassword
};
