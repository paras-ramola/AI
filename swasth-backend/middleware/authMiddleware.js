const jwt = require("jsonwebtoken");

// Must match the secret used in server.js.
const JWT_SECRET = process.env.JWT_SECRET || 'swasth_dev_secret_change_in_prod';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      // 401 = expired — frontend interceptor will auto-logout on this.
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    // 403 = token is present but malformed/tampered.
    return res.status(403).json({ error: "Invalid token." });
  }
};

module.exports = verifyToken;
