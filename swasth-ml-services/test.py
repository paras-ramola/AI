import pandas as pd

# Load your dataset
df = pd.read_csv("Datasets/data.csv")
# Get symptom columns (skip 'diseases')
# Get symptom columns
symptom_columns = df.columns[1:]

rows = []

for _, row in df.iterrows():
    disease = row["diseases"]

    # collect all symptoms with value 1
    symptoms = [sym for sym in symptom_columns if row[sym] == 1]

    # join into single string
    symptom_str = "|".join(symptoms)

    rows.append({
        "disease": disease,
        "symptoms": symptom_str
    })

# Create new dataframe
new_df = pd.DataFrame(rows)

# Save file
new_df.to_csv("disease_symptom_rows.csv", index=False)

print("✅ File created: disease_symptom_rows.csv")