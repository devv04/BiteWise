from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta
import re
import json
import time
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Database setup ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bitewise.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class ScanResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    food_name = db.Column(db.String(100), nullable=True)
    health_score = db.Column(db.String(50), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    warnings = db.Column(db.Text, nullable=True)
    allergens = db.Column(db.Text, nullable=True)
    disease_risk = db.Column(db.Text, nullable=True)
    suggestions = db.Column(db.Text, nullable=True)
    nutrient_values = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'foodName': self.food_name,
            'healthScore': self.health_score,
            'reason': self.reason,
            'warnings': json.loads(self.warnings) if self.warnings else [],
            'allergens': json.loads(self.allergens) if self.allergens else [],
            'diseaseRisk': json.loads(self.disease_risk) if self.disease_risk else [],
            'suggestions': json.loads(self.suggestions) if self.suggestions else [],
            'nutrientValues': json.loads(self.nutrient_values) if self.nutrient_values else {},
            'timestamp': self.created_at.isoformat() if self.created_at else None
        }

with app.app_context():
    db.create_all()

@app.route("/")
def home():
    return "Bitewise Backend is running!"

# --- Gemini client setup ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in .env file!")
client = genai.Client(api_key=GEMINI_API_KEY)


# --- Helper: parse numeric value from strings like "365 kcal" or "17 g" ---
def parse_nutrient_value(value_str):
    if not value_str or value_str == 'N/A':
        return 0.0
    try:
        nums = re.findall(r'[\d.]+', str(value_str))
        if nums:
            # If range like "500-650", take the average
            if len(nums) >= 2 and '-' in str(value_str):
                return (float(nums[0]) + float(nums[1])) / 2
            return float(nums[0])
    except (ValueError, IndexError):
        pass
    return 0.0


# --- Gemini Vision Handler ---
def analyze_food_with_gemini(image_data, mime_type, retries=2):
    prompt = """Analyze the food in this image. Provide a detailed health analysis in a JSON format.
The JSON should have the following structure:
{
  "foodName": "Name of the food item detected (e.g., 'French Fries', 'Caesar Salad', 'Chicken Biryani')",
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
If no food is detected in the image, set foodName to "No food detected" and healthScore to "N/A".
If you cannot confidently determine a specific value or list, use 'N/A' for values or an empty array for lists.
Focus on general health, common nutrient estimates based on visual identification, and identify potential disease risks linked to the food."""

    image_part = types.Part.from_bytes(data=image_data, mime_type=mime_type)

    for attempt in range(retries + 1):
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=[image_part, prompt]
            )
            response_text = response.text.strip()
            if response_text.startswith('```json') and response_text.endswith('```'):
                json_str = response_text[7:-3].strip()
            else:
                json_str = response_text
            return json.loads(json_str)

        except Exception as e:
            error_str = str(e)
            print(f"Gemini API Error (attempt {attempt + 1}/{retries + 1}): {e}")
            if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                if attempt < retries:
                    print(f"Rate limited. Waiting 60s before retry...")
                    time.sleep(60)
                    continue
                else:
                    raise ValueError("API rate limit reached. Please wait a minute and try again.")
            else:
                raise ValueError(f"Gemini analysis failed: {error_str}")


def build_result(gemini_result):
    food_name = gemini_result.get("foodName", "Unknown Food")
    health_score = gemini_result.get("healthScore", "Unknown")
    reason = gemini_result.get("reason", "Analysis provided by AI.")
    warnings = gemini_result.get("warnings", [])
    allergens = gemini_result.get("allergens", [])
    disease_risk = gemini_result.get("diseaseRisk", [])
    suggestions = gemini_result.get("suggestions", [])
    nutrient_values = gemini_result.get("nutrientValues", {
        "calories": "N/A", "protein": "N/A", "carbohydrates": "N/A", "fat": "N/A", "fiber": "N/A"
    })

    if not warnings:
        warnings = ["No specific warnings detected."]
    if not allergens:
        allergens = ["None detected."]
    if not disease_risk:
        disease_risk = ["None detected"]
    if not suggestions:
        suggestions = ["Eat a balanced diet and consult a nutritionist."]

    return {
        "foodName": food_name,
        "healthScore": health_score,
        "reason": reason,
        "warnings": warnings,
        "allergens": allergens,
        "diseaseRisk": disease_risk,
        "suggestions": suggestions,
        "nutrientValues": nutrient_values
    }


# --- Analyze endpoint ---
@app.route("/analyze", methods=["POST"])
def analyze_image_route():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image_file = request.files["image"]
    try:
        image_bytes = image_file.read()
        mime_type = image_file.content_type
        gemini_result = analyze_food_with_gemini(image_bytes, mime_type)
        final_result = build_result(gemini_result)

        # Save to database
        try:
            scan = ScanResult(
                food_name=final_result.get('foodName', 'Unknown Food'),
                health_score=final_result.get('healthScore', 'Unknown'),
                reason=final_result.get('reason', ''),
                warnings=json.dumps(final_result.get('warnings', [])),
                allergens=json.dumps(final_result.get('allergens', [])),
                disease_risk=json.dumps(final_result.get('diseaseRisk', [])),
                suggestions=json.dumps(final_result.get('suggestions', [])),
                nutrient_values=json.dumps(final_result.get('nutrientValues', {})),
            )
            db.session.add(scan)
            db.session.commit()
            final_result['id'] = scan.id
            final_result['timestamp'] = scan.created_at.isoformat()
        except Exception as db_err:
            print(f"WARNING: Failed to save to database: {db_err}")
            db.session.rollback()

        return jsonify(final_result)
    except Exception as e:
        print(f"ERROR: Analysis failed: {str(e)}")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


# --- History endpoint ---
@app.route("/history", methods=["GET"])
def get_history():
    try:
        scans = ScanResult.query.order_by(ScanResult.created_at.desc()).limit(50).all()
        return jsonify([scan.to_dict() for scan in scans])
    except Exception as e:
        return jsonify([]), 500


# --- Daily Summary endpoint (NEW FEATURE) ---
@app.route("/daily-summary", methods=["GET"])
def daily_summary():
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        scans = ScanResult.query.filter(ScanResult.created_at >= today_start).all()

        total_calories = 0
        total_protein = 0
        total_carbs = 0
        total_fat = 0
        total_fiber = 0
        foods_eaten = []
        score_counts = {"Healthy": 0, "Moderately Healthy": 0, "Unhealthy": 0}

        for scan in scans:
            nutrients = json.loads(scan.nutrient_values) if scan.nutrient_values else {}
            total_calories += parse_nutrient_value(nutrients.get('calories', '0'))
            total_protein += parse_nutrient_value(nutrients.get('protein', '0'))
            total_carbs += parse_nutrient_value(nutrients.get('carbohydrates', '0'))
            total_fat += parse_nutrient_value(nutrients.get('fat', '0'))
            total_fiber += parse_nutrient_value(nutrients.get('fiber', '0'))

            if scan.food_name and scan.food_name != 'No food detected':
                foods_eaten.append({
                    'name': scan.food_name,
                    'healthScore': scan.health_score,
                    'calories': parse_nutrient_value(nutrients.get('calories', '0')),
                    'time': scan.created_at.strftime('%I:%M %p') if scan.created_at else ''
                })

            if scan.health_score in score_counts:
                score_counts[scan.health_score] += 1

        calorie_goal = 2000
        return jsonify({
            'totalScans': len(scans),
            'calorieGoal': calorie_goal,
            'totalCalories': round(total_calories),
            'calorieProgress': min(round((total_calories / calorie_goal) * 100), 100),
            'macros': {
                'protein': round(total_protein, 1),
                'carbohydrates': round(total_carbs, 1),
                'fat': round(total_fat, 1),
                'fiber': round(total_fiber, 1),
            },
            'foodsEaten': foods_eaten,
            'scoreCounts': score_counts,
        })
    except Exception as e:
        print(f"ERROR: Daily summary failed: {e}")
        return jsonify({'totalScans': 0, 'calorieGoal': 2000, 'totalCalories': 0,
                        'calorieProgress': 0, 'macros': {}, 'foodsEaten': [], 'scoreCounts': {}}), 500


if __name__ == "__main__":
    print("-" * 50)
    print("Bitewise Backend Server")
    print("API: http://localhost:5001")
    print("-" * 50)
    app.run(debug=True, port=5001, host='0.0.0.0')