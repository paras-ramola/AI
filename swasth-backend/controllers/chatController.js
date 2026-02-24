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

    // If frontend sends string, convert to array
    if (typeof symptoms === "string") {
      symptoms = [symptoms];
    }

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: "Symptoms must be an array" });
    }

    const userId = req.user?.userId || 1; // fallback for testing

    const mlResponse = await axios.post(
      "http://localhost:5001/predict",
      { symptoms }
    );

    const { disease, confidence } = mlResponse.data;

    await pool.query(
      "INSERT INTO chat_history (user_id, symptoms, predicted_disease) VALUES ($1, $2, $3)",
      [userId, symptoms.join(","), disease]
    );

    res.json({ disease, confidence });

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ error: "Prediction failed" });
  }
};