from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pickle
import os
from catboost import CatBoostClassifier

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ===============================
# Load CatBoost Model
# ===============================

model_path = os.path.join(BASE_DIR, "models/catboost_disease_model.cbm")

model = CatBoostClassifier()
model.load_model(model_path)

# ===============================
# Load Symptoms Dictionary
# ===============================

symptoms_dict = pickle.load(
    open(os.path.join(BASE_DIR, "models/symptoms_dict.pkl"), "rb")
)

print("Model loaded successfully")
print("Total symptoms:", len(symptoms_dict))


# ===============================
# Prediction Function
# ===============================
def predict_disease(patient_symptoms):

    input_vector = np.zeros(len(symptoms_dict))

    invalid_symptoms = []

    for symptom in patient_symptoms:
        symptom = symptom.lower().strip()

        if symptom in symptoms_dict:
            input_vector[symptoms_dict[symptom]] = 1
        else:
            invalid_symptoms.append(symptom)

    if invalid_symptoms:
        return {
            "success": False,
            "error": f"Invalid symptoms: {invalid_symptoms}"
        }

    input_vector = input_vector.reshape(1, -1)

    # Get probabilities for all diseases
    probs = model.predict_proba(input_vector)[0]

    disease_names = model.classes_

    # Get top 3 diseases
    top3_idx = np.argsort(probs)[-3:][::-1]

    predictions = []

    for idx in top3_idx:
        predictions.append({
            "disease": str(disease_names[idx]),
            "probability": float(probs[idx])
        })

    return {
        "success": True,
        "predictions": predictions
    }
# ===============================
# API Route
# ===============================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON received"
            }), 400

        symptoms = data.get("symptoms")

        if not symptoms:
            return jsonify({
                "success": False,
                "error": "No symptoms provided"
            }), 400

        if isinstance(symptoms, str):
            symptoms = [symptoms]

        result = predict_disease(symptoms)

        return jsonify(result)

    except Exception as e:

        print("ML ERROR:", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ===============================
# Endpoint for Angular Dropdown
# ===============================

@app.route("/symptoms", methods=["GET"])
def get_symptoms():

    return jsonify(list(symptoms_dict.keys()))


# ===============================
# Run Server
# ===============================

if __name__ == "__main__":
    app.run(debug=True, port=5001)