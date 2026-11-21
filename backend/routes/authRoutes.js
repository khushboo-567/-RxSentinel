const express = require("express");

const {
    registerUser,
    loginUser
} = require("../controllers/authController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// Verify JWT authentication
router.get("/verify", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Authentication successful",
        user: req.user
    });
});

module.exports = router;