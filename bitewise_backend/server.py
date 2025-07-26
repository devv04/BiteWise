from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import re
import requests
import numpy as np
from sklearn.linear_model import LogisticRegression
import json
import cv2
from googletrans import Translator
import google.generativeai as genai
import os

app = Flask(__name__)
CORS(app)

# --- Basic home route ---
@app.route("/")
def home():
    return "Bitewise Backend is running!"

# --- Gemini API Key setup ---
GEMINI_API_KEY = "AIzaSyAMsoCxKsJKWSW0Ie-lsJUDFhK2PbapL4g"
genai.configure(api_key=GEMINI_API_KEY)

# --- Dummy Logistic Regression (optional use) ---
X_train = np.array([
    [5.0, 1.2, 10.0, 0],
    [2.0, 0.5, 3.0, 1],
    [8.0, 1.5, 15.0, 0],
    [3.0, 0.7, 5.0, 1],
])
y_train = np.array([0, 1, 0, 1])
model = LogisticRegression().fit(X_train, y_train)

translator = Translator()

def get_image_parts(image_data, mime_type):
    return {'mime_type': mime_type, 'data': image_data}

# --- Gemini Vision Handler ---
def analyze_food_with_gemini(image_data, mime_type):
    try:
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = """Analyze the food in this image. Provide a detailed health analysis in a JSON format.
The JSON should have the following structure:
{
  "healthScore": "Healthy" | "Moderately Healthy" | "Unhealthy",
  "reason": "Brief explanation of why it's healthy/unhealthy.",
  "warnings": ["List of potential warnings, e.g., 'High in sugar', 'High in saturated fat', 'High in sodium', 'Processed food', 'Contains artificial ingredients'"],
  "allergens": ["List of common allergens detected or likely present (e.g., 'Gluten', 'Dairy', 'Nuts', 'Soy', 'Eggs')"],
  "diseaseRisk": ["List of potential disease risks based on the food, e.g., 'Diabetes', 'Heart Disease', 'Obesity', 'None detected'"],
  "suggestions": ["List of suggestions for healthier alternatives or portion control."],
  "nutrientValues": {
    "calories": "X kcal",
    "protein": "X g",
    "carbohydrates": "X g",
    "fat": "X g",
    "fiber": "X g"
  }
}
If you cannot confidently determine a specific value or list, use 'N/A' for values or an empty array for lists.
Focus on general health, common nutrient estimates based on visual identification, and identify potential disease risks (e.g., diabetes from high sugar, heart disease from high fat) linked to the food's appearance or common knowledge."""

        image_part = get_image_parts(image_data, mime_type)
        response = gemini_model.generate_content([image_part, prompt], stream=False)

        response_text = response.text.strip()

        if response_text.startswith('```json') and response_text.endswith('```'):
            json_str = response_text[7:-3].strip()
        else:
            json_str = response_text

        return json.loads(json_str)

    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise ValueError(f"Gemini analysis failed: {str(e)}")

# --- OCR + Fallback Helpers ---
def preprocess_image_ocr(image):
    img_cv = np.array(image)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)

def extract_text_from_image_ocr(image):
    try:
        preprocessed = preprocess_image_ocr(image)
        return pytesseract.image_to_string(preprocessed).strip()
    except Exception as e:
        print(f"OCR failed: {e}")
        return ""

def parse_ingredients_ocr(text):
    ingredients = re.split(r',|\n|;', text.lower())
    return [ing.strip() for ing in ingredients if ing.strip() and len(ing.strip()) > 1]

def fetch_nutrition_data_fallback(ingredients, lang):
    try:
        query = ingredients[0] if ingredients else "food"
        if lang != 'en':
            query = translator.translate(query, src='en', dest=lang).text
        response = requests.get(f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&action=process&json=1", timeout=5)
        if response.status_code == 200 and response.json().get('products'):
            data = response.json()['products'][0].get('nutriments', {})
            return {
                'saturated_fat': float(data.get('saturated-fat_100g', 0)),
                'sodium': float(data.get('sodium_100g', 0)),
                'sugar': float(data.get('sugars_100g', 0))
            }
    except Exception as e:
        print(f"OpenFoodFacts error: {e}")
    return {'saturated_fat': 5.0, 'sodium': 1.2, 'sugar': 10.0}

def detect_allergens_fallback(ingredients):
    allergens = ['peanut', 'gluten', 'milk', 'egg', 'soy', 'wheat', 'nut', 'lactose']
    detected = [ing for ing in ingredients for allergen in allergens if allergen in ing]
    return detected if detected else ['None detected']

def combine_analysis_results(gemini_result, ocr_ingredients, fallback_nutrition_data):
    health_score = gemini_result.get("healthScore", "Unknown")
    reason = gemini_result.get("reason", "Analysis provided by AI.")
    warnings = gemini_result.get("warnings", [])
    allergens = gemini_result.get("allergens", [])
    disease_risk = gemini_result.get("diseaseRisk", [])
    suggestions = gemini_result.get("suggestions", [])
    nutrient_values = gemini_result.get("nutrientValues", {
        "calories": "N/A", "protein": "N/A", "carbohydrates": "N/A", "fat": "N/A", "fiber": "N/A"
    })

    # Enhanced suggestions with veg and non-veg options
    if not suggestions:
        suggestions = [
            "Quinoa salad (vegetarian)",
            "Lentil soup (vegetarian)",
            "Grilled chicken (non-vegetarian)",
            "Fish curry (non-vegetarian)",
            "Eat a balanced diet and consult a nutritionist."
        ]

    if ocr_ingredients:
        ocr_allergens = detect_allergens_fallback(ocr_ingredients)
        for allergen in ocr_ingredients:
            if allergen not in allergens and allergen != 'None detected':
                allergens.append(allergen)

    # Fallback for disease risk if not provided by Gemini
    if not disease_risk:
        disease_risk = ["None detected"]
        if "High in sugar" in warnings or float(nutrient_values.get("carbohydrates", "0").replace("g", "")) > 20:
            disease_risk.append("Diabetes")
        if "High in saturated fat" in warnings or float(nutrient_values.get("fat", "0").replace("g", "")) > 10:
            disease_risk.append("Heart Disease")
        if float(nutrient_values.get("calories", "0").replace("kcal", "")) > 500:
            disease_risk.append("Obesity")

    if not warnings:
        warnings = ["No specific warnings detected."]
    if not allergens:
        allergens = ["None detected."]

    return {
        "healthScore": health_score,
        "reason": reason,
        "warnings": warnings,
        "allergens": allergens,
        "diseaseRisk": disease_risk,
        "suggestions": suggestions,
        "nutrientValues": nutrient_values
    }

# --- Flask Route (sync now) ---
@app.route("/analyze", methods=["POST"])
def analyze_image_route():
    print("DEBUG: analyze_image_route: Request received at /analyze endpoint.")
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image_file = request.files["image"]
    lang = request.form.get("language", "en")
    print(f"DEBUG: Image received. MIME Type: {image_file.content_type}, Language: {lang}")

    try:
        image_bytes = image_file.read()
        mime_type = image_file.content_type
        print("DEBUG: Calling Gemini analyzer...")
        gemini_result = analyze_food_with_gemini(image_bytes, mime_type)
        print("DEBUG: Gemini analysis returned.")

        final_result = combine_analysis_results(gemini_result, [], {})
        return jsonify(final_result)
    except Exception as e:
        print(f"ERROR: Full analysis failed: {str(e)}")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

# --- Start Flask Server ---
if __name__ == "__main__":
    print("-" * 50)
    print("Bitewise Backend Server is Starting...")
    print("Frontend App URL: http://localhost:3000")
    print("Backend API Endpoint: http://localhost:5001/analyze")
    print("Press Ctrl+C to stop the server.")
    print("-" * 50)
    app.run(debug=True, port=5001, host='0.0.0.0')