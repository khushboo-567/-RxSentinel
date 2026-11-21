const express = require("express");
const {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    changePassword
} = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// Profile and session verification
router.get("/verify", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Authentication valid",
        user: req.user
    });
});

router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.post("/change-password", authenticateToken, changePassword);

module.exports = router;
