# BiteWise
A smart food monitoring app which detects your food's image and tells you if it's healthy or unhealthy. Thus forces you to opt for better food choices

BiteWise - Food Health Analyzer

Overview:
BiteWise is an innovative application designed to help users assess the healthiness of their food through image analysis. By uploading or capturing an image of food, BiteWise provides a detailed health analysis, including a health score, potential warnings, allergens, disease risks, and nutritional suggestions. The app leverages AI-powered image recognition and natural language processing to deliver insightful recommendations, making it a valuable tool for health-conscious individuals.
This repository contains both the frontend and backend code for the BiteWise application.
Features

Image-Based Analysis: Analyze food images captured via camera or uploaded files.
Health Score: Categorizes food as "Healthy", "Moderately Healthy", or "Unhealthy".
Detailed Insights: Provides reasons, warnings, allergens, disease risks, and nutritional values.
Multilingual Support: Supports English, Spanish, and French.
Health Dashboard: Tracks scan history for the last 5 analyses.
Suggestions: Offers vegetarian and non-vegetarian healthier alternatives.
Interactive UI: Features animations, GIFs, and a responsive design.

Tech Stack
Frontend

Framework: React with Vite
Styling: Tailwind CSS
Animation: Framer Motion
HTTP Requests: Axios
Media Handling: HTML5 Canvas, File API
Dependencies: Hosted via CDN (e.g., React, ReactDOM)

Backend

Framework: Flask
CORS: Flask-CORS
Image Processing: OpenCV (cv2), Pillow (PIL)
OCR: Pytesseract
AI/ML: Google Generative AI (Gemini), Scikit-learn (Logistic Regression - optional)
Translation: googletrans
Data Source: OpenFoodFacts API (fallback)
Language: Python

Requirements
System Requirements

Operating System: Windows, macOS, or Linux
Memory: Minimum 4GB RAM (8GB recommended)
Storage: At least 2GB free space
Internet: Required for API calls and dependency downloads

Software Requirements

Python: Version 3.8 or higher
Node.js: Version 18 or higher
npm: Included with Node.js
Git: For cloning the repository

Python Dependencies

flask
flask-cors
pytesseract
pillow
opencv-python
numpy
scikit-learn
google-generativeai
googletrans==3.1.0a0
requests

Frontend Dependencies

Automatically managed via package.json (installed with npm install)

Installation
Clone the Repository
git clone https://github.com/devv04/BiteWise.git
cd bitewise

Backend Setup

Navigate to Backend Directory
cd bitewise_backend


Create a Virtual Environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate


Install Python Dependencies
pip install -r requirements.txt


Create a requirements.txt file with the listed Python dependencies if not already present.


Set Up Gemini API Key

Obtain a Gemini API key from Google AI Studio.
Replace the GEMINI_API_KEY value in app.py with your key.


Install Tesseract OCR

Download and install Tesseract OCR from here.
Add Tesseract to your system PATH.



Frontend Setup

Navigate to Frontend Directory
cd ../bitewise_frontend


Install Node Dependencies
npm install


Prepare Environment

Ensure the backend is running on http://localhost:5001 (default).



Running the Application
Start the Backend

Activate the virtual environment (if not already active):source venv/bin/activate  # On Windows: venv\Scripts\activate


Run the Flask server:python app.py


The backend will start on http://localhost:5001.
Access the home route at http://localhost:5001/ to confirm it’s running.



Start the Frontend

In the bitewise_frontend directory, run:npm run dev


Open your browser and navigate to http://localhost:3000 (or the URL provided in the terminal).

Testing

Upload or capture an image of food (e.g., a fruit, burger, or salad).
The app will display the health analysis, including disease risks, on the screen.

Project Structure
bitewise/
├── bitewise_backend/      # Flask backend code
│   ├── app.py            # Main backend script
│   └── requirements.txt  # Python dependencies
├── bitewise_frontend/    # React frontend code
   ├── public/           # Static assets (e.g., GIFs, logo)
   ├── src/              # Source code (e.g., App.jsx)
   ├── package.json      # Node dependencies
   └── vite.config.js    # Vite configuration

Usage

Capture Food Image: Use the camera button to snap a photo.
Upload Image: Select an image file from your device.
Select Language: Choose from English, Spanish, or French.
Analyze: Click "Analyze Food" to get the health report.
View History: Check the dashboard for past scans.

Contributing

Fork the repository.
Create a new branch (git checkout -b feature-branch).
Make your changes and commit (git commit -m "Description").
Push to the branch (git push origin feature-branch).
Open a Pull Request.

L
Acknowledgments

Google Generative AI for image analysis.
OpenFoodFacts for nutritional data fallback.
Tesseract OCR for text extraction.
The open-source community for tools like Flask, React, and Tailwind CSS.

Contact
For issues or suggestions, please open an issue on GitHub or contact devg55030@gmail.com
