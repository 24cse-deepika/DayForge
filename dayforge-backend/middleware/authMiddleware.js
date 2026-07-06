const { verifyToken } = require("../utils/jwt");

/**
 * Protects JSON/API routes: reads the JWT from the "token" cookie, verifies it,
 * and attaches the decoded payload to req.user. Responds 401 on failure.
 */
function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload; // { id, email, iat, exp }
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/**
 * Protects EJS page routes — redirects to /login instead of returning JSON 401.
 */
function authenticatePage(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.redirect("/login");
  }
}

module.exports = { authenticate, authenticatePage };