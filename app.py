from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__, static_folder='static', static_url_path='')

# Configure database
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'postgresql://postgres:postgres@localhost:5432/judging'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
CORS(app)

# Define models
class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    judge = db.Column(db.String(100), nullable=False)
    team = db.Column(db.String(100), nullable=False)
    score = db.Column(db.Float, nullable=False)
    __table_args__ = (db.UniqueConstraint('judge', 'team', name='unique_judge_team'),)

# Initialize database
def init_db():
    """Initialize the database."""
    try:
        with app.app_context():
            # Create tables if they don't exist
            db.create_all()
            logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

# Initialize database
init_db()

# Serve static files
@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

# API routes
@app.route('/api/scores', methods=['GET'])
def get_scores():
    scores = Score.query.all()
    return jsonify([{
        'id': score.id,
        'judge': score.judge,
        'team': score.team,
        'score': score.score
    } for score in scores])

@app.route('/api/scores', methods=['POST'])
def add_score():
    data = request.get_json()
    try:
        score = Score(
            judge=data['judge'],
            team=data['team'],
            score=data['score']
        )
        db.session.add(score)
        db.session.commit()
        return jsonify({'message': 'Score added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/judges', methods=['GET'])
def get_judges():
    scores = Score.query.all()
    judges = list(set(score.judge for score in scores))
    return jsonify(judges)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
