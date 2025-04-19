
import datetime
from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
from sqlalchemy.types import JSON

class User(UserMixin, db.Model):
    """User model for authentication and personal information"""
    __tablename__ = 'users'  # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    health_logs = db.relationship('HealthLog', backref='user', lazy='dynamic')
    chat_sessions = db.relationship('ChatSession', backref='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class HealthLog(db.Model):
    """Model for storing user health journal entries"""
    __tablename__ = 'health_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    symptom = db.Column(db.String(200), nullable=False)
    severity = db.Column(db.Integer)  # 1-10 scale
    description = db.Column(db.Text)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<HealthLog {self.symptom} - {self.recorded_at}>'

class ChatSession(db.Model):
    """Model for storing chat history"""
    __tablename__ = 'chat_sessions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), default="New Conversation")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    messages = db.relationship('ChatMessage', backref='session', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<ChatSession {self.id} - {self.title}>'

class ChatMessage(db.Model):
    """Model for storing individual chat messages"""
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False)
    is_user = db.Column(db.Boolean, default=True)  # True if user, False if system
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # text, image, voice
    image_path = db.Column(db.String(255))  # Path to uploaded image, if any
    audio_path = db.Column(db.String(255))  # Path to uploaded audio, if any
    health_analysis = db.Column(db.Text)  # AI-generated health analysis
    severity_level = db.Column(db.Integer)  # 0-none, 1-low, 2-medium, 3-high
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ChatMessage {self.id}>'

class AuditLog(db.Model):
    """Model for storing security audit logs"""
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    ip_address = db.Column(db.String(45), nullable=False)
    endpoint = db.Column(db.String(255), nullable=False)
    method = db.Column(db.String(10), nullable=False)
    status_code = db.Column(db.Integer, nullable=False)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AuditLog {self.event_type}>'

class ScalabilityMetrics(db.Model):
    """Model for storing scalability metrics"""
    __tablename__ = 'scalability_metrics'
    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.String(50), nullable=False)
    cpu_usage = db.Column(db.Float, nullable=False)
    memory_usage = db.Column(db.Float, nullable=False)
    request_count = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ScalabilityMetrics {self.server_id}>'

class PerformanceMetric(db.Model):
    """Model for storing performance metrics"""
    __tablename__ = 'performance_metrics'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Float, nullable=False)
    metric_data = db.Column(JSON)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<PerformanceMetric {self.label}>'
