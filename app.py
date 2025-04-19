import os
import logging
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_login import LoginManager
import uuid

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

# Initialize extensions
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # needed for url_for to generate with https

# Configure the database
# Use a writable path for SQLite database
db_path = os.path.join(os.getcwd(), 'instance', 'health_app.db')
os.makedirs(os.path.dirname(db_path), exist_ok=True)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size


# Configure login manager
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message_category = "info"

# Initialize the app with the extension
db.init_app(app)

with app.app_context():
    # Import models
    import models  # noqa: F401
    from models import User

    # Initialize database
    db.create_all()

    # Create uploads directory if it doesn't exist
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Setup user loader for Flask-Login
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Import security and scalability modules
    from security_audit import security_audit #This module needs to be created separately
    from scalability import load_balancer #This module needs to be created separately
    import uuid

    # Generate unique server ID for this instance
    SERVER_ID = str(uuid.uuid4())

    # Security middleware
    @app.before_request
    def security_middleware():
        # Log request start
        security_audit.log_event('request_start')

        # Record load balancing metrics
        load_balancer.record_metrics(SERVER_ID)

    @app.after_request
    def after_request_middleware(response):
        # Log request completion
        security_audit.log_event('request_complete', 
                               status_code=response.status_code,
                               details={'server_id': SERVER_ID})
        return response

    # Health check endpoint for load balancer
    @app.route('/lb-health')
    def lb_health():
        cpu_load = load_balancer.get_server_load()
        return jsonify({
            'status': 'healthy' if cpu_load < 80 else 'overloaded',
            'cpu_load': cpu_load,
            'server_id': SERVER_ID
        })

    # Import routes after initializing db to avoid circular imports
    import routes  # noqa: F401

    logger.info(f"Application initialized successfully on server {SERVER_ID}")

    # Store initial metrics
    load_balancer.record_metrics(SERVER_ID)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=False)
