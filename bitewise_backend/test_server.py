"""
Tests for BiteWise Backend API endpoints.
Run with: pytest test_server.py -v
"""
import pytest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from server import app, db, ScanResult


@pytest.fixture
def client():
    """Create a test client with an in-memory database."""
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    with app.app_context():
        db.create_all()
    with app.test_client() as client:
        yield client
    with app.app_context():
        db.drop_all()


@pytest.fixture
def sample_scan(client):
    """Insert a sample scan result into the test database."""
    with app.app_context():
        scan = ScanResult(
            food_name='French Fries',
            health_score='Unhealthy',
            reason='High in fat and calories.',
            warnings=json.dumps(['High in fat', 'High in sodium']),
            allergens=json.dumps(['Gluten']),
            disease_risk=json.dumps(['Obesity', 'Heart Disease']),
            suggestions=json.dumps(['Try baked potatoes instead.']),
            nutrient_values=json.dumps({
                'calories': '365 kcal', 'protein': '3 g',
                'carbohydrates': '48 g', 'fat': '17 g', 'fiber': '4 g'
            }),
        )
        db.session.add(scan)
        db.session.commit()
        return scan.id


class TestHomeRoute:
    def test_home_returns_200(self, client):
        assert client.get('/').status_code == 200

    def test_home_returns_message(self, client):
        assert b'Bitewise Backend is running!' in client.get('/').data


class TestHistoryEndpoint:
    def test_returns_200(self, client):
        assert client.get('/history').status_code == 200

    def test_returns_empty_list(self, client):
        assert json.loads(client.get('/history').data) == []

    def test_returns_saved_scans(self, client, sample_scan):
        data = json.loads(client.get('/history').data)
        assert len(data) == 1
        assert data[0]['foodName'] == 'French Fries'

    def test_includes_all_fields(self, client, sample_scan):
        item = json.loads(client.get('/history').data)[0]
        for f in ['id', 'foodName', 'healthScore', 'reason', 'warnings', 'allergens', 'diseaseRisk', 'suggestions', 'nutrientValues', 'timestamp']:
            assert f in item

    def test_ordered_most_recent_first(self, client):
        with app.app_context():
            db.session.add(ScanResult(food_name='Salad', health_score='Healthy', warnings='[]', allergens='[]', disease_risk='[]', suggestions='[]', nutrient_values='{}'))
            db.session.commit()
            db.session.add(ScanResult(food_name='Pizza', health_score='Unhealthy', warnings='[]', allergens='[]', disease_risk='[]', suggestions='[]', nutrient_values='{}'))
            db.session.commit()
        data = json.loads(client.get('/history').data)
        assert data[0]['foodName'] == 'Pizza'


class TestAnalyzeEndpoint:
    def test_requires_image(self, client):
        resp = client.post('/analyze')
        assert resp.status_code == 400
        assert 'No image provided' in json.loads(resp.data)['error']

    def test_post_only(self, client):
        assert client.get('/analyze').status_code == 405


class TestDailySummary:
    def test_returns_200(self, client):
        assert client.get('/daily-summary').status_code == 200

    def test_empty_summary(self, client):
        data = json.loads(client.get('/daily-summary').data)
        assert data['totalScans'] == 0
        assert data['totalCalories'] == 0

    def test_aggregates_scans(self, client, sample_scan):
        data = json.loads(client.get('/daily-summary').data)
        assert data['totalScans'] == 1
        assert data['totalCalories'] == 365
        assert data['macros']['protein'] == 3.0
        assert data['macros']['fat'] == 17.0
        assert len(data['foodsEaten']) == 1
        assert data['foodsEaten'][0]['name'] == 'French Fries'
