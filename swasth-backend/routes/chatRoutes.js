const express = require('express');//Express is the web framework that lets Node handle HTTP requests.
const router = express.Router();
const { chatPredict } = require("../controllers/chatController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/chat", verifyToken, chatPredict);

module.exports = router;