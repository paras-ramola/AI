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
# LOAD MODEL ARTIFACTS
# ===============================

model = CatBoostClassifier()
model.load_model(os.path.join(BASE_DIR,"models/disease_prediction_model.cbm"))

symptom_columns = pickle.load(
    open(os.path.join(BASE_DIR,"models/symptom_columns.pkl"),"rb")
)

disease_classes = pickle.load(
    open(os.path.join(BASE_DIR,"models/disease_classes.pkl"),"rb")
)

# ===============================
# PREDICTION FUNCTION
# ===============================

def predict_disease(patient_symptoms):

    input_vector = np.zeros(len(symptom_columns))

    for symptom in patient_symptoms:
        if symptom in symptom_columns:
            index = symptom_columns.index(symptom)
            input_vector[index] = 1

    input_vector = input_vector.reshape(1,-1)

    probs = model.predict_proba(input_vector)[0]

    top3_idx = np.argsort(probs)[-3:][::-1]

    predictions = []

    for i in top3_idx:
        predictions.append({
            "disease": disease_classes[i],
            "confidence": float(probs[i])
        })

    return predictions


# ===============================
# API ENDPOINT
# ===============================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.get_json()

        symptoms = data.get("symptoms")

        if not symptoms:
            return jsonify({"error":"No symptoms provided"}),400

        predictions = predict_disease(symptoms)

        return jsonify({
            "predictions": predictions
        })

    except Exception as e:

        print("ERROR:",str(e))

        return jsonify({"error":str(e)}),500


# ===============================
# START SERVER
# ===============================

if __name__ == "__main__":
    app.run(debug=True,port=5001)