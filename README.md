<p align="center">
  <img src="bitewise_frontend/foodscan/public/logo.png" alt="BiteWise Logo" width="120" />
</p>

<h1 align="center">BiteWise</h1>

<p align="center">
  <strong>AI-Powered Food Health Analyzer</strong><br/>
  Snap a photo of your food → get instant health insights, nutrient breakdown, and smarter alternatives.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-2.5_Flash-4285F4?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white" />
</p>

---

## What It Does

BiteWise uses **Google Gemini AI** to analyze food images and deliver:

- 🏷️ **Food Detection** — identifies the food item from a photo
- 🟢🟡🔴 **Health Score** — Healthy / Moderately Healthy / Unhealthy
- ⚠️ **Warnings** — high sugar, sodium, saturated fat, processed ingredients
- 🧬 **Allergen Detection** — gluten, dairy, nuts, soy, eggs
- 🩺 **Disease Risk Assessment** — diabetes, heart disease, obesity links
- 💡 **Healthier Alternatives** — practical suggestions for better choices
- 📊 **Nutrient Breakdown** — calories, protein, carbs, fat, fiber
- 🎯 **Daily Nutrition Tracker** — calorie ring, macro progress bars, food log

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · Vite · Framer Motion · Axios |
| **Backend** | Flask · Flask-CORS · Flask-SQLAlchemy |
| **AI Engine** | Google Gemini 2.5 Flash (with 2.0 Flash fallback) |
| **Database** | SQLite |
| **Styling** | Tailwind CSS · Inline health-themed design system |

## Quick Start

### Prerequisites

- **Python** ≥ 3.8
- **Node.js** ≥ 18
- **Gemini API Key** — get one free at [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone

```bash
git clone https://github.com/devv04/BiteWise.git
cd BiteWise
```

### 2. Backend Setup

```bash
cd bitewise_backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure API key
echo GEMINI_API_KEY=your_key_here > .env

# Start server
python server.py
```

Backend runs at **http://localhost:5001**

### 3. Frontend Setup

```bash
cd bitewise_frontend/foodscan

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:3000**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/analyze` | Analyze a food image (multipart form: `image`) |
| `GET` | `/history` | Get last 50 scan results |
| `GET` | `/daily-summary` | Today's nutrition totals and food log |

## Project Structure

```
BiteWise/
├── bitewise_backend/
│   ├── server.py            # Flask API + Gemini AI integration
│   ├── test_server.py       # Pytest test suite
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # API key (not committed)
│   └── instance/
│       └── bitewise.db      # SQLite database (auto-created)
│
├── bitewise_frontend/
│   └── foodscan/
│       ├── src/
│       │   ├── App.jsx      # Main application component
│       │   ├── main.jsx     # React entry point
│       │   └── index.css    # Global styles
│       ├── public/
│       │   └── logo.png     # BiteWise logo
│       ├── package.json
│       └── vite.config.js
│
├── .gitignore
└── README.md
```

## Running Tests

```bash
cd bitewise_backend
.\venv\Scripts\python.exe -m pytest test_server.py -v
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Contact

**Dev** — [devg55030@gmail.com](mailto:devg55030@gmail.com)

Got issues or ideas? [Open an issue](https://github.com/devv04/BiteWise/issues) →
