const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");

const {
    getUserAllergies,
    addUserAllergy,
    deleteUserAllergy
} = require("../controllers/allergyController");

const router = express.Router();

// All allergy routes require authentication
router.use(authenticateToken);

// GET: View user's allergies
router.get("/", getUserAllergies);

// POST: Add a new allergy
router.post("/", addUserAllergy);

// DELETE: Remove an allergy
router.delete("/:allergyId", deleteUserAllergy);

module.exports = router;