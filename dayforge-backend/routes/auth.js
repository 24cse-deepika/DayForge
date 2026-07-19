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
const { handleValidationErrors } = require("../middleware/validationMiddleware");
const { registerValidators, loginValidators } = require("../validators/authValidators");

const router = express.Router();

router.post("/register", registerValidators, handleValidationErrors, register);
router.post("/login", loginValidators, handleValidationErrors, login);

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

router.post("/logout", logout);
router.get("/me", authenticate, getCurrentUser);

module.exports = router;