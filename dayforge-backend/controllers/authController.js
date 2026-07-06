const bcrypt = require("bcrypt");
const passport = require("passport");
const { generateToken } = require("../utils/jwt");
const {
  findUserByEmail,
  createLocalUser,
} = require("../repositories/userRepository");
 
const SALT_ROUNDS = 10;
 
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiry
};
 
function setAuthCookie(res, user) {
  const token = generateToken(user);
  res.cookie("token", token, COOKIE_OPTIONS);
}
 
// POST /auth/register
async function register(req, res) {
  try {
    const { email, password } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
 
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
 
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createLocalUser({ email, passwordHash });
 
    setAuthCookie(res, user);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong during registration" });
  }
}
 
// POST /auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
 
    const user = await findUserByEmail(email);
 
    // Google-only accounts have no password_hash — don't let bcrypt.compare blow up on null.
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
 
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
 
    setAuthCookie(res, user);
    res.status(200).json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong during login" });
  }
}
 
// GET /auth/google
const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});
 
// GET /auth/google/callback
function googleCallback(req, res, next) {
  passport.authenticate(
    "google",
    { session: false, failureRedirect: "/login" },
    (err, user) => {
      if (err || !user) {
        console.error("Google auth error:", err);
        return res.redirect("/login");
      }
      setAuthCookie(res, user);
      res.redirect("/dashboard");
    }
  )(req, res, next);
}
 
// POST /auth/logout
function logout(req, res) {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out" });
}
 
// GET /auth/me
function getCurrentUser(req, res) {
  // req.user is set by the authenticate middleware (decoded JWT payload)
  res.status(200).json({ id: req.user.id, email: req.user.email });
}
 
module.exports = {
  register,
  login,
  googleLogin,
  googleCallback,
  logout,
  getCurrentUser,
};
 