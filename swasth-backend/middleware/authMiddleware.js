const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log("Authorization header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "MY_SECRET_KEY");
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT ERROR MESSAGE:", err.message);
    console.log("JWT ERROR NAME:", err.name);
    return res.status(403).json({ error: "Invalid token" });
  }
};

module.exports = verifyToken;
