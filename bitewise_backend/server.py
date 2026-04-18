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
import jwt
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_dev_secret_key')

# --- Database setup ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bitewise.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    age = db.Column(db.Integer, nullable=True)
    weight = db.Column(db.Float, nullable=True)
    height = db.Column(db.Float, nullable=True)
    goal = db.Column(db.String(50), nullable=True)
    calorie_goal = db.Column(db.Integer, default=2000)

class ScanResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
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

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
        
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                raise Exception("User not found")
        except Exception as e:
            return jsonify({'error': 'Token is invalid!', 'details': str(e)}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing username or password'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    goal = data.get('goal', 'maintain')
    weight = float(data.get('weight', 70))
    height = float(data.get('height', 170))
    age = int(data.get('age', 30))
    
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
    tdee = bmr * 1.55
    if goal == 'loss':
        calorie_goal = int(tdee - 500)
    elif goal == 'gain':
        calorie_goal = int(tdee + 500)
    else:
        calorie_goal = int(tdee)
    calorie_goal = max(1200, calorie_goal)

    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(
        username=data['username'], 
        password_hash=hashed_password,
        age=age, weight=weight, height=height, goal=goal, calorie_goal=calorie_goal
    )
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'Registered successfully'})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing credentials'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token, 'username': user.username, 'calorieGoal': user.calorie_goal})

@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    return jsonify({'username': current_user.username, 'calorieGoal': current_user.calorie_goal})

@app.route("/")
def home():
    return "Bitewise Backend is running!"

# --- Gemini client setup ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in .env file!")
client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={'timeout': 30_000}  # 30 second timeout
)

# Model fallback chain — tries each in order if rate-limited
MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']


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
def analyze_food_with_gemini(image_data, mime_type, retries=1):
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
    last_error = None

    for model_name in MODELS:
        for attempt in range(retries + 1):
            try:
                print(f"Trying {model_name} (attempt {attempt + 1})...")
                response = client.models.generate_content(
                    model=model_name,
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
                last_error = e
                print(f"Gemini API Error ({model_name}, attempt {attempt + 1}/{retries + 1}): {e}")
                if 'timed out' in error_str.lower() or 'timeout' in error_str.lower():
                    if attempt < retries:
                        print("Request timed out. Retrying...")
                        continue
                    else:
                        break  # Try next model
                elif '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                    if attempt < retries:
                        print(f"Rate limited on {model_name}. Waiting 5s before retry...")
                        time.sleep(5)
                        continue
                    else:
                        print(f"{model_name} rate limited. Trying next model...")
                        break  # Try next model
                else:
                    break  # Non-retryable error, try next model

    # All models failed
    raise ValueError(f"All models failed. Last error: {last_error}")


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
@token_required
def analyze_image_route(current_user):
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
                user_id=current_user.id,
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
@token_required
def get_history(current_user):
    try:
        scans = ScanResult.query.filter_by(user_id=current_user.id).order_by(ScanResult.created_at.desc()).limit(50).all()
        return jsonify([scan.to_dict() for scan in scans])
    except Exception as e:
        return jsonify([]), 500


# --- Daily Summary endpoint (NEW FEATURE) ---
@app.route("/daily-summary", methods=["GET"])
@token_required
def daily_summary(current_user):
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        scans = ScanResult.query.filter(ScanResult.user_id == current_user.id, ScanResult.created_at >= today_start).all()

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

        calorie_goal = current_user.calorie_goal
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

# --- Weekly Analytics endpoint ---
@app.route("/weekly-analytics", methods=["GET"])
@token_required
def weekly_analytics(current_user):
    try:
        days_data = []
        for i in range(6, -1, -1):
            date = datetime.now(timezone.utc) - timedelta(days=i)
            start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            scans = ScanResult.query.filter(
                ScanResult.user_id == current_user.id, 
                ScanResult.created_at >= start_of_day,
                ScanResult.created_at < end_of_day
            ).all()
            
            day_calories = 0
            healthy_count = 0
            for scan in scans:
                nutrients = json.loads(scan.nutrient_values) if scan.nutrient_values else {}
                day_calories += parse_nutrient_value(nutrients.get('calories', '0'))
                if scan.health_score == "Healthy":
                    healthy_count += 1
                elif scan.health_score == "Moderately Healthy":
                    healthy_count += 0.5
                    
            avg_health = min(100, int((healthy_count / len(scans)) * 100)) if len(scans) > 0 else 0
                
            days_data.append({
                'name': date.strftime('%a'),
                'calories': round(day_calories),
                'healthScore': avg_health
            })
            
        return jsonify({
            'calorieGoal': current_user.calorie_goal,
            'data': days_data
        })
    except Exception as e:
        print(f"ERROR: Weekly analytics failed: {e}")
        return jsonify({'error': str(e)}), 500

# --- Chat endpoint ---
@app.route("/chat/<int:scan_id>", methods=["POST"])
@token_required
def chat_about_scan(current_user, scan_id):
    scan = ScanResult.query.filter_by(id=scan_id, user_id=current_user.id).first()
    if not scan:
        return jsonify({"error": "Scan not found or unauthorized"}), 404
        
    data = request.get_json()
    user_message = data.get("message")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
        
    prompt = f"""
You are Bitewise, a helpful AI nutrition assistant.
The user is asking a question about a food they scanned: "{scan.food_name}".
Here is the context of the scanned food:
- Health Score: {scan.health_score}
- Reason: {scan.reason}
- Warnings: {scan.warnings}
- Allergens: {scan.allergens}
- Nutrients: {scan.nutrient_values}

User Question: {user_message}

Answer concisely, helpfully, and stay focused on the food context and nutrition. Keep it under 3-4 sentences.
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt]
        )
        return jsonify({"reply": response.text.strip()})
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": "Failed to get AI response"}), 500

if __name__ == "__main__":
    print("-" * 50)
    print("Bitewise Backend Server")
    print("API: http://localhost:5001")
    print("-" * 50)
    app.run(debug=True, port=5001, host='0.0.0.0')