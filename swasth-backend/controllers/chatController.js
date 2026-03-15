const axios = require("axios");
const pool = require("../db");

exports.chatPredict = async (req, res) => {
  try {
    console.log("Incoming body:", req.body);
    console.log("User:", req.user);

    let { symptoms } = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: "No symptoms provided" });
    }

    // Convert string → array
    if (typeof symptoms === "string") {
      symptoms = [symptoms];
    }

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: "Symptoms must be an array" });
    }

    const userId = req.user?.userId || 1;

    // Call ML service
    const mlResponse = await axios.post("http://localhost:5001/predict", {
      symptoms,
    });

    console.log("ML RESPONSE:", mlResponse.data);

    const result = mlResponse.data;

    if (!result.success) {
      return res.status(400).json(result);
    }

    const predictions = result.predictions;

    const topDisease = predictions[0].disease;

    // Save chat history
    await pool.query(
      "INSERT INTO chat_history (user_id, symptoms, predicted_disease) VALUES ($1, $2, $3)",
      [userId, symptoms.join(","), topDisease],
    );

    // Send full ML result to Angular
    res.json(result);
  } catch (error) {
    console.error("FULL ERROR:", error.response?.data || error.message);

    res.status(500).json({
      error: "Prediction failed",
    });
  }
};
