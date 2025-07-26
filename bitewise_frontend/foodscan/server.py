from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import io
import re
import requests
import numpy as np
from sklearn.linear_model import LogisticRegression
import json
import cv2
from googletrans import Translator

app = Flask(__name__)
CORS(app)

# Train a simple logistic regression model with synthetic data
X_train = np.array([
    [5.0, 1.2, 10.0, 0],  # Unhealthy: high fat, sodium, sugar
    [2.0, 0.5, 3.0, 1],   # Healthy: low values, whole grains
    [8.0, 1.5, 15.0, 0],  # Unhealthy: very high values
    [3.0, 0.7, 5.0, 1],   # Healthy: moderate values, whole grains
])
y_train = np.array([0, 1, 0, 1])  # 0: Unhealthy, 1: Healthy
model = LogisticRegression().fit(X_train, y_train)

translator = Translator()

def preprocess_image(image):
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)

def extract_text_from_image(image):
    preprocessed = preprocess_image(image)
    return pytesseract.image_to_string(preprocessed).strip()

def parse_ingredients(text):
    ingredients = re.split(r',|\n|;', text.lower())
    return [ing.strip() for ing in ingredients if ing.strip() and len(ing.strip()) > 1]

def fetch_nutrition_data(ingredients, lang):
    try:
        query = ingredients[0] if ingredients else "food"
        if lang != 'en':
            translated_query = translator.translate(query, src='en', dest=lang).text
            print(f"Translated query to {lang}: {translated_query}")  # Debug print
            query = translated_query
        response = requests.get(f"https://world.openfoodfacts.org/cgi/product.pl?code={query}&lc={lang}&json=1", timeout=5)
        print(f"API response status: {response.status_code}, URL: {response.url}, Language: {lang}")  # Debug API call
        if response.status_code == 200 and response.json().get('product'):
            data = response.json()['product'].get('nutriments', {})
            return {
                'saturated_fat': float(data.get('saturated-fat_100g', 0)),
                'sodium': float(data.get('sodium_100g', 0)),
                'sugar': float(data.get('sugars_100g', 0))
            }
    except Exception as e:
        print(f"API error: {e}")
    return {'saturated_fat': 5.0, 'sodium': 1.2, 'sugar': 10.0}  # Default fallback

def detect_allergens(ingredients):
    allergens = ['peanut', 'gluten', 'milk', 'egg', 'soy', 'wheat', 'nut', 'lactose']
    detected = [ing for ing in ingredients for allergen in allergens if allergen in ing]
    return detected if detected else ['None detected']

def analyze_nutrition(ingredients, nutrition_data):
    features = np.array([[nutrition_data['saturated_fat'], nutrition_data['sodium'], nutrition_data['sugar'], 1 if 'whole' in ' '.join(ingredients) else 0]])
    prob = model.predict_proba(features)[0]
    health_score = "Healthy" if prob[1] > 0.7 else "Moderately Healthy" if prob[1] > 0.3 else "Unhealthy"

    warnings = []
    if nutrition_data['saturated_fat'] > 5:
        warnings.append("High saturated fat")
    if nutrition_data['sodium'] > 1:
        warnings.append("High sodium")
    if nutrition_data['sugar'] > 8:
        warnings.append("High sugar")

    suggestions = ["Choose whole grain options", "Opt for low-sodium alternatives"]

    reason = f"This food is {health_score.lower()} due to {', '.join(warnings) or 'balanced nutrition'}."

    return {
        "healthScore": health_score,
        "reason": reason,
        "warnings": warnings or ["None"],
        "suggestions": suggestions,
        "allergens": detect_allergens(ingredients)
    }

@app.route("/analyze", methods=["POST"])
def analyze_image():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image = request.files["image"]
    lang = request.form.get("language", "en")
    print(f"Received language: {lang}")  # Debug language parameter

    try:
        img = Image.open(io.BytesIO(image.read()))
        text = extract_text_from_image(img)
        ingredients = parse_ingredients(text)
        nutrition_data = fetch_nutrition_data(ingredients, lang)
        result = analyze_nutrition(ingredients, nutrition_data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000, host='0.0.0.0')