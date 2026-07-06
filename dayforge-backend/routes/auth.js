const express = require('express');

const {
    register,
    login,
    logout,
    googleLogin,
    googleCallback,
    getCurrentUser
} = require('../controllers/authController');

const { authenticate } = require("../middleware/authMiddleware");
 
const router = express.Router();
 
router.post("/register", register);
router.post("/login", login);

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
 
router.post("/logout", logout);
router.get("/me", authenticate, getCurrentUser);
 
module.exports = router;