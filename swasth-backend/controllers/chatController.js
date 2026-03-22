const axios  = require("axios");
const pool   = require("../db");
const { v4: uuidv4 } = require("uuid");

const ML_URL = "http://localhost:5001";


// =============================================================================
// LEGACY — chatPredict
// =============================================================================

exports.chatPredict = async (req, res) => {
  try {
    let { symptoms } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!symptoms) return res.status(400).json({ error: "No symptoms provided" });
    if (typeof symptoms === "string") symptoms = [symptoms];
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: "Symptoms must be an array" });
    }

    const mlResponse = await axios.post(`${ML_URL}/predict`, { symptoms });
    const data       = mlResponse.data;

    if (data.is_emergency) {
      await pool.query(
        `INSERT INTO chat_history (user_id, symptoms, predicted_disease, is_emergency, emergency_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, symptoms.join(","), data.suspected_condition || "Emergency", true, data.message]
      );
      return res.json({ is_emergency: true, ...data, predictions: [] });
    }

    const predictions = data.predictions;
    if (!predictions || predictions.length === 0) {
      return res.status(500).json({ error: "No predictions returned" });
    }

    await pool.query(
      `INSERT INTO chat_history (user_id, symptoms, predicted_disease, is_emergency)
       VALUES ($1, $2, $3, $4)`,
      [userId, symptoms.join(","), predictions[0].disease, false]
    );

    return res.json({ is_emergency: false, normalized_symptoms: data.normalized_symptoms, predictions });

  } catch (error) {
    console.error("chatPredict error:", error.message);
    res.status(500).json({ error: "Prediction failed" });
  }
};


// =============================================================================
// LEGACY — chatClarify
// =============================================================================

exports.chatClarify = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let { message, session_id, collected_symptoms, questions_asked, conversation_history } = req.body;

    if (!message) return res.status(400).json({ error: "No message provided" });

    if (!session_id) {
      session_id           = uuidv4();
      collected_symptoms   = [];
      questions_asked      = 0;
      conversation_history = [];

      await pool.query(
        `INSERT INTO chat_sessions (user_id, session_id, collected_symptoms, questions_asked, conversation_history)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, session_id, JSON.stringify([]), 0, JSON.stringify([])]
      );
    }

    const mlResponse = await axios.post(`${ML_URL}/clarify`, {
      message,
      collected_symptoms:   collected_symptoms   || [],
      questions_asked:      questions_asked      || 0,
      conversation_history: conversation_history || []
    });

    const data = mlResponse.data;

    await pool.query(
      `UPDATE chat_sessions
       SET collected_symptoms=$1, questions_asked=$2, conversation_history=$3,
           mode=$4, updated_at=CURRENT_TIMESTAMP
       WHERE session_id=$5`,
      [
        JSON.stringify(data.collected_symptoms || []),
        data.questions_asked || 0,
        JSON.stringify(data.conversation_history || []),
        data.status || "triage",
        session_id
      ]
    );

    if (data.status === "emergency") {
      await pool.query(
        `INSERT INTO chat_history (user_id, symptoms, predicted_disease, is_emergency, emergency_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, (data.collected_symptoms||[]).join(","), data.suspected_condition||"Emergency", true, data.message]
      );
      return res.json({ status: "emergency", session_id, ...data });
    }

    if (data.status === "predicted") {
      await pool.query(
        `INSERT INTO chat_history (user_id, symptoms, predicted_disease, is_emergency)
         VALUES ($1, $2, $3, $4)`,
        [userId, (data.normalized_symptoms||[]).join(","), data.predictions[0].disease, false]
      );
      return res.json({ status: "predicted", session_id, ...data });
    }

    return res.json({ status: "clarifying", session_id, ...data });

  } catch (error) {
    console.error("chatClarify error:", error.message);
    res.status(500).json({ error: "Clarification failed" });
  }
};


// =============================================================================
// LEGACY — savePrediction
// =============================================================================

exports.savePrediction = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { session_id, disease, confidence, symptoms, attempt_number } = req.body;

    if (!disease || !symptoms) return res.status(400).json({ error: "Missing fields" });

    const explainRes  = await axios.post(`${ML_URL}/explain`, { disease, symptoms, confidence });
    const explanation = explainRes.data.explanation;

    const result = await pool.query(
      `INSERT INTO predictions (session_id, user_id, symptoms, predicted_disease, confidence, explanation, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [session_id, userId, JSON.stringify(symptoms), disease, confidence, explanation, attempt_number || 1]
    );

    return res.json({ prediction_id: result.rows[0].id, disease, confidence, explanation });

  } catch (error) {
    console.error("savePrediction error:", error.message);
    res.status(500).json({ error: "Failed" });
  }
};


// =============================================================================
// LEGACY — submitFeedback
// =============================================================================

exports.submitFeedback = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      prediction_id, feedback_type, user_comment, predicted_disease,
      symptoms, confidence, session_id, collected_symptoms,
      questions_asked, conversation_history
    } = req.body;

    if (!feedback_type) return res.status(400).json({ error: "feedback_type required" });

    if (feedback_type === "like") {
      await pool.query(
        `INSERT INTO prediction_feedback (prediction_id, user_id, feedback_type, resolution)
         VALUES ($1, $2, $3, $4)`,
        [prediction_id, userId, "like", "accepted"]
      );
      return res.json({ status: "accepted", message: "Thank you. Please consult a doctor for proper diagnosis." });
    }

    if (!user_comment) return res.status(400).json({ error: "user_comment required" });

    const feedbackRes = await axios.post(`${ML_URL}/feedback`, {
      predicted_disease, user_comment,
      symptoms:   symptoms   || [],
      confidence: confidence || 0
    });
    const evaluation = feedbackRes.data;

    await pool.query(
      `INSERT INTO prediction_feedback (prediction_id, user_id, feedback_type, user_comment,
         llm_evaluation, user_was_correct, resolution)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [prediction_id, userId, "dislike", user_comment,
       evaluation.reasoning, evaluation.user_correct, evaluation.action]
    );

    if (evaluation.user_correct) {
      await pool.query(
        `UPDATE chat_sessions SET questions_asked=0, mode='triage', updated_at=CURRENT_TIMESTAMP
         WHERE session_id=$1`,
        [session_id]
      );
      return res.json({
        status:              "continuing",
        user_correct:        true,
        response_to_patient: evaluation.response_to_patient,
        action:              "continue_questions",
        session_state: {
          session_id, mode: "triage",
          collected_symptoms, questions_asked: 0, conversation_history
        }
      });
    }

    return res.json({
      status:              "explaining",
      user_correct:        false,
      response_to_patient: evaluation.response_to_patient,
      action:              "explain_prediction",
      prediction: { disease: predicted_disease, confidence, symptoms: symptoms || [] }
    });

  } catch (error) {
    console.error("submitFeedback error:", error.message);
    res.status(500).json({ error: "Failed" });
  }
};


// =============================================================================
// NEW — symptomsSearch
// =============================================================================

exports.symptomsSearch = async (req, res) => {
  try {
    const q = req.query.q || "";
    const mlResponse = await axios.get(`${ML_URL}/symptoms/search`, { params: { q } });
    return res.json(mlResponse.data);
  } catch (error) {
    console.error("symptomsSearch error:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
};


// =============================================================================
// NEW — assessStart
// =============================================================================

exports.assessStart = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { selected_symptoms } = req.body;

    if (!selected_symptoms || selected_symptoms.length === 0) {
      return res.status(400).json({ error: "No symptoms selected" });
    }

    // verify user exists before any insert
    const userCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1",
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ error: "User not found — please log in again" });
    }

    const session_id = uuidv4();

    await pool.query(
      `INSERT INTO assessments
         (user_id, session_id, selected_symptoms, confirmed_symptoms,
          absent_symptoms, asked_symptoms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        session_id,
        JSON.stringify(selected_symptoms),
        JSON.stringify(selected_symptoms),
        JSON.stringify([]),
        JSON.stringify([])
      ]
    );

    const mlResponse = await axios.post(`${ML_URL}/assess/start`, { selected_symptoms });
    const data       = mlResponse.data;

    if (data.status === "emergency") {
      await pool.query(
        `UPDATE assessments SET status='emergency', updated_at=CURRENT_TIMESTAMP
         WHERE session_id=$1`,
        [session_id]
      );
      return res.json({ session_id, ...data });
    }

    if (data.asked_symptoms) {
      await pool.query(
        `UPDATE assessments
         SET asked_symptoms=$1, questions_asked=$2, updated_at=CURRENT_TIMESTAMP
         WHERE session_id=$3`,
        [JSON.stringify(data.asked_symptoms), data.questions_asked || 1, session_id]
      );
    }

    return res.json({ session_id, ...data });

  } catch (error) {
    console.error("assessStart error:", error.message);
    res.status(500).json({ error: "Failed to start assessment" });
  }
};


// =============================================================================
// NEW — assessAnswer
// =============================================================================

exports.assessAnswer = async (req, res) => {
  try {
    const userId     = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const session_id = req.body.session_id;
    if (!session_id) return res.status(400).json({ error: "session_id required" });

    const mlResponse = await axios.post(`${ML_URL}/assess/answer`, req.body);
    const data       = mlResponse.data;

    await pool.query(
      `UPDATE assessments
       SET confirmed_symptoms=$1, absent_symptoms=$2, asked_symptoms=$3,
           questions_asked=$4, status=$5, updated_at=CURRENT_TIMESTAMP
       WHERE session_id=$6`,
      [
        JSON.stringify(data.confirmed_symptoms || []),
        JSON.stringify(data.absent_symptoms    || []),
        JSON.stringify(data.asked_symptoms     || []),
        data.questions_asked || 0,
        data.status,
        session_id
      ]
    );

    if (data.status === "predicted") {
      await pool.query(
        `INSERT INTO chat_history (user_id, symptoms, predicted_disease, is_emergency)
         VALUES ($1, $2, $3, $4)`,
        [userId, (data.confirmed_symptoms||[]).join(","), data.predictions[0].disease, false]
      );
    }

    if (data.status === "emergency") {
      await pool.query(
        `INSERT INTO chat_history
           (user_id, symptoms, predicted_disease, is_emergency, emergency_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, (data.confirmed_symptoms||[]).join(","),
         data.suspected_condition||"Emergency", true, data.message]
      );
    }

    return res.json({ session_id, ...data });

  } catch (error) {
    console.error("assessAnswer error:", error.message);
    res.status(500).json({ error: "Failed to process answer" });
  }
};


// =============================================================================
// NEW — assessExplain
// =============================================================================

exports.assessExplain = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { session_id, disease, confidence, symptoms } = req.body;
    if (!disease) return res.status(400).json({ error: "disease required" });

    const mlResponse = await axios.post(
      `${ML_URL}/assess/explain`,
      { disease, confidence, symptoms }
    );
    const data = mlResponse.data;

    const assessResult = await pool.query(
      `INSERT INTO assessment_results
         (assessment_id, user_id, predicted_disease, confidence, explanation)
       SELECT a.id, $1, $2, $3, $4
       FROM assessments a WHERE a.session_id = $5
       RETURNING id`,
      [userId, disease, confidence, data.explanation, session_id]
    );

    return res.json({
      result_id:   assessResult.rows[0]?.id,
      disease,
      confidence,
      explanation: data.explanation
    });

  } catch (error) {
    console.error("assessExplain error:", error.message);
    res.status(500).json({ error: "Failed to get explanation" });
  }
};


// =============================================================================
// NEW — assessFeedback
// =============================================================================

exports.assessFeedback = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      result_id, session_id, feedback_type, user_comment,
      predicted_disease, symptoms, confidence
    } = req.body;

    if (!feedback_type) return res.status(400).json({ error: "feedback_type required" });

    if (feedback_type === "like") {
      if (result_id) {
        await pool.query(
          `UPDATE assessment_results SET feedback_type='like' WHERE id=$1`,
          [result_id]
        );
      }
      await pool.query(
        `UPDATE assessments SET status='completed', updated_at=CURRENT_TIMESTAMP
         WHERE session_id=$1`,
        [session_id]
      );
      return res.json({
        status:  "accepted",
        message: "Thank you. Please consult a real doctor for proper diagnosis and treatment."
      });
    }

    if (!user_comment) return res.status(400).json({ error: "user_comment required" });

    const feedbackRes = await axios.post(`${ML_URL}/assess/feedback`, {
      predicted_disease,
      user_comment,
      symptoms:   symptoms   || [],
      confidence: confidence || 0
    });
    const evaluation = feedbackRes.data;

    if (result_id) {
      await pool.query(
        `UPDATE assessment_results
         SET feedback_type='dislike', feedback_comment=$1, user_was_correct=$2
         WHERE id=$3`,
        [user_comment, evaluation.user_correct, result_id]
      );
    }

    if (evaluation.user_correct) {
      await pool.query(
        `UPDATE assessments
         SET questions_asked=0, absent_symptoms='[]', asked_symptoms='[]',
             status='in_progress', updated_at=CURRENT_TIMESTAMP
         WHERE session_id=$1`,
        [session_id]
      );
      return res.json({
        status:              "continuing",
        user_correct:        true,
        response_to_patient: evaluation.response_to_patient,
        action:              "restart_questions"
      });
    }

    return res.json({
      status:              "explaining",
      user_correct:        false,
      response_to_patient: evaluation.response_to_patient,
      action:              "explain_prediction"
    });

  } catch (error) {
    console.error("assessFeedback error:", error.message);
    res.status(500).json({ error: "Failed to process feedback" });
  }
};