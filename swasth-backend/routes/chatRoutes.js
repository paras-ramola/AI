const express     = require("express");
const router      = express.Router();
const controller  = require("../controllers/chatController");
const verifyToken = require("../middleware/authMiddleware");

// legacy
router.post("/chat",            verifyToken, controller.chatPredict);
router.post("/clarify",         verifyToken, controller.chatClarify);
router.post("/prediction",      verifyToken, controller.savePrediction);
router.post("/feedback",        verifyToken, controller.submitFeedback);

// new assessment flow
router.get("/symptoms/search",         verifyToken, controller.symptomsSearch);
router.post("/assess/start",           verifyToken, controller.assessStart);
router.post("/assess/answer",          verifyToken, controller.assessAnswer);
router.post("/assess/explain",         verifyToken, controller.assessExplain);
router.post("/assess/feedback",        verifyToken, controller.assessFeedback);
router.post("/assess/recommendations", verifyToken, controller.assessRecommendations);
router.get("/history",                 verifyToken, controller.getHistory);

module.exports = router;