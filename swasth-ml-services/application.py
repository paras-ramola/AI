from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pickle
import os

app = Flask(__name__)

# ✅ Proper CORS configuration
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load model files
svc = pickle.load(open(os.path.join(BASE_DIR, "models/svc.pkl"), "rb"))
encoder = pickle.load(open(os.path.join(BASE_DIR, "models/label_encoder.pkl"), "rb"))
symptoms_dict = pickle.load(open(os.path.join(BASE_DIR, "models/symptoms_dict.pkl"), "rb"))

def predict_disease(patient_symptoms):
    input_vector = np.zeros(len(symptoms_dict))

    for symptom in patient_symptoms:
        if symptom in symptoms_dict:
            input_vector[symptoms_dict[symptom]] = 1

    prediction_index = svc.predict([input_vector])[0]
    disease_name = encoder.inverse_transform([prediction_index])[0]

    confidence = None
    if hasattr(svc, "predict_proba"):
        probs = svc.predict_proba([input_vector])
        confidence = float(np.max(probs))

    return disease_name, confidence


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)

        if not data:
            return jsonify({"error": "No JSON received"}), 400

        symptoms = data.get("symptoms")

        if not symptoms:
            return jsonify({"error": "No symptoms provided"}), 400

        if isinstance(symptoms, str):
            symptoms = [symptoms]

        disease, confidence = predict_disease(symptoms)

        return jsonify({
            "disease": disease,
            "confidence": confidence
        })

    except Exception as e:
        print("FLASK ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)