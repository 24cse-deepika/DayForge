const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');

// If someone's already logged in and hits /login or /register, send them
// straight to the dashboard instead of showing the form again.
function redirectIfAuthenticated(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    verifyToken(token);
    return res.redirect('/dashboard');
  } catch (err) {
    res.clearCookie('token');
    return next();
  }
}

router.get('/', (req, res) => {
  res.redirect('/login');
});

router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login');
});

router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('register');
});

module.exports = router;