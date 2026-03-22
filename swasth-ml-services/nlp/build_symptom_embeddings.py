import pandas as pd
import json
import pickle
from sentence_transformers import SentenceTransformer


df=pd.read_csv("Datasets/data.csv")


# Extract symptom columns (skip disease column)
symptom_list = list(df.columns)[1:]


print("Total symptoms:", len(symptom_list))

# Save symptom list
with open("data/symptom_list.json", "w") as f:
    json.dump(symptom_list, f)

print("Symptom list saved.")


# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

print("Creating embeddings...")

symptom_embeddings = model.encode(symptom_list)

# Save embeddings
with open("data/symptom_embeddings.pkl", "wb") as f:
    pickle.dump(symptom_embeddings, f)

print("Embeddings saved successfully.")

