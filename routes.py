import os
import uuid
import time
import json
import base64
import logging
import requests
from io import BytesIO
from datetime import datetime

from flask import render_template, redirect, url_for, flash, request, jsonify, session, send_from_directory
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename

from app import app, db
from models import User, HealthLog, ChatSession, ChatMessage, PerformanceMetric, AuditLog
from scalability import load_balancer
from forms import LoginForm, RegistrationForm, HealthLogForm
from groq_service import generate_health_response, analyze_health_question, analyze_symptoms_patterns
from gemini_service import analyze_image
from audio_service import transcribe_audio

logger = logging.getLogger(__name__)

# Allowed file extensions
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'ogg'}

def allowed_image_file(filename):
    """Check if uploaded file has allowed image extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

def allowed_audio_file(filename):
    """Check if uploaded file has allowed audio extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_AUDIO_EXTENSIONS

# Routes
@app.route('/')
def landing():
    """Landing page with product information"""
    return render_template('landing.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login route"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('dashboard'))
        else:
            flash('Invalid email or password', 'danger')

    return render_template('login.html', form=form)

@app.route('/register', methods=['GET', 'POST'])
def register():
    """User registration route"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = RegistrationForm()
    if form.validate_on_submit():
        user = User.query.filter((User.email == form.email.data) | (User.username == form.username.data)).first()
        if user:
            flash('Email or username already exists', 'danger')
        else:
            user = User(
                username=form.username.data,
                email=form.email.data,
                first_name=form.first_name.data,
                last_name=form.last_name.data,
                date_of_birth=form.date_of_birth.data,
                gender=form.gender.data
            )
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            flash('Account created successfully! You can now log in.', 'success')
            return redirect(url_for('login'))

    return render_template('register.html', form=form)

@app.route('/logout')
@login_required
def logout():
    """User logout route"""
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('landing'))

@app.route('/dashboard')
@login_required
def dashboard():
    """Main dashboard with chat interface"""
    # Get active session or create new one
    active_session_id = session.get('active_session_id')

    if active_session_id:
        chat_session = ChatSession.query.filter_by(id=active_session_id, user_id=current_user.id).first()
        if not chat_session:
            # If session doesn't exist or doesn't belong to user, create new one
            chat_session = ChatSession(user_id=current_user.id)
            db.session.add(chat_session)
            db.session.commit()
            session['active_session_id'] = chat_session.id
    else:
        # Create new session
        chat_session = ChatSession(user_id=current_user.id)
        db.session.add(chat_session)
        db.session.commit()
        session['active_session_id'] = chat_session.id

    # Get all user sessions for sidebar
    user_sessions = ChatSession.query.filter_by(user_id=current_user.id).order_by(ChatSession.created_at.desc()).all()

    # Get messages for current session
    messages = ChatMessage.query.filter_by(session_id=chat_session.id).order_by(ChatMessage.created_at.asc()).all()

    return render_template('dashboard.html', 
                           session=chat_session, 
                           messages=messages, 
                           user_sessions=user_sessions)

@app.route('/health-journal', methods=['GET', 'POST'])
@login_required
def health_journal():
    """Health journal for logging symptoms and tracking health"""
    form = HealthLogForm()

    if form.validate_on_submit():
        log = HealthLog(
            user_id=current_user.id,
            symptom=form.symptom.data,
            severity=form.severity.data,
            description=form.description.data
        )
        db.session.add(log)
        db.session.commit()
        flash('Health log added successfully', 'success')
        return redirect(url_for('health_journal'))

    # Get all health logs
    logs = HealthLog.query.filter_by(user_id=current_user.id).order_by(HealthLog.recorded_at.desc()).all()

    return render_template('health_journal.html', form=form, logs=logs)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    """User profile management"""
    if request.method == 'POST':
        current_user.first_name = request.form.get('first_name')
        current_user.last_name = request.form.get('last_name')

        date_of_birth_str = request.form.get('date_of_birth')
        if date_of_birth_str:
            try:
                current_user.date_of_birth = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
            except ValueError:
                flash('Invalid date format', 'danger')
                return redirect(url_for('profile'))

        current_user.gender = request.form.get('gender')

        # Check if password change was requested
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if new_password:
            if new_password != confirm_password:
                flash('Passwords do not match', 'danger')
                return redirect(url_for('profile'))

            current_user.set_password(new_password)

        db.session.commit()
        flash('Profile updated successfully', 'success')
        return redirect(url_for('profile'))

    return render_template('profile.html')

@app.route('/api/chat/new-session', methods=['POST'])
@login_required
def new_chat_session():
    """API route to create a new chat session"""
    try:
        chat_session = ChatSession(user_id=current_user.id)
        db.session.add(chat_session)
        db.session.commit()

        session['active_session_id'] = chat_session.id

        return jsonify({
            'success': True,
            'session_id': chat_session.id
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating new session: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to create new session'}), 500

@app.route('/api/chat/select-session/<int:session_id>', methods=['POST'])
@login_required
def select_chat_session(session_id):
    """API route to select an existing chat session"""
    chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()
    session['active_session_id'] = chat_session.id

    return jsonify({
        'success': True,
        'session_id': chat_session.id
    })

@app.route('/api/chat/rename-session/<int:session_id>', methods=['POST'])
@login_required
def rename_chat_session(session_id):
    """API route to rename an existing chat session"""
    chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

    title = request.json.get('title')
    if title:
        chat_session.title = title
        db.session.commit()

    return jsonify({
        'success': True,
        'session_id': chat_session.id,
        'title': chat_session.title
    })

@app.route('/api/chat/delete-session/<int:session_id>', methods=['POST'])
@login_required
def delete_chat_session(session_id):
    """API route to delete a chat session"""
    try:
        chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first()
        if not chat_session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404

        # Check if this is the active session
        is_active = session.get('active_session_id') == chat_session.id

        db.session.delete(chat_session)
        db.session.commit()

        # If we deleted the active session, create a new one
        if is_active:
            try:
                new_session = ChatSession(user_id=current_user.id)
                db.session.add(new_session)
                db.session.commit()
                session['active_session_id'] = new_session.id
                new_session_id = new_session.id
            except Exception as e:
                logger.error(f"Error creating replacement session: {str(e)}")
                return jsonify({'success': False, 'error': 'Failed to create replacement session'}), 500
        else:
            new_session_id = None

        return jsonify({
            'success': True,
            'new_session_id': new_session_id
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting session: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to delete session'}), 500

@app.route('/api/chat/send-message', methods=['POST'])
@login_required
def send_message():
    """API route to send a text message and get AI response"""
    session_id = session.get('active_session_id')
    if not session_id:
        return jsonify({'success': False, 'error': 'No active session'}), 400

    chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first()
    if not chat_session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404

    content = request.json.get('message', '').strip()
    if not content:
        return jsonify({'success': False, 'error': 'Empty message'}), 400

    # Save user message
    user_message = ChatMessage(
        session_id=session_id,
        is_user=True,
        content=content,
        message_type='text'
    )
    db.session.add(user_message)
    db.session.commit()

    try:
        # Analyze message for health insights
        health_analysis = analyze_health_question(content)

        # Generate AI response
        ai_response = generate_health_response(content)

        # Determine severity level (0-none, 1-low, 2-medium, 3-high)
        severity_level = health_analysis.get('severity', 0)

        # Add emergency information for severe cases (level 3)
        if severity_level == 3 or health_analysis.get('emergency', False):
            emergency_info = """

**EMERGENCY CONTACT INFORMATION (INDIA):**
- **National Emergency Number:** 112
- **Ambulance:** 108 or 102
- **Medical Helpline:** 104
- **COVID-19 Helpline:** 1075
- **Women Helpline:** 1091

**Please seek immediate medical attention for serious symptoms.**
"""
            ai_response += emergency_info

        # For moderate concern, add general helpline information
        elif severity_level == 2:
            helpline_info = """

**HEALTH HELPLINE INFORMATION (INDIA):**
- **Medical Helpline:** 104
- **COVID-19 Helpline:** 1075
- **Mental Health Helpline:** 1800-599-0019
"""
            ai_response += helpline_info

        # Save AI response
        ai_message = ChatMessage(
            session_id=session_id,
            is_user=False,
            content=ai_response,
            message_type='text',
            health_analysis=str(health_analysis),
            severity_level=severity_level
        )
        db.session.add(ai_message)

        # Update session title if it's the default title
        if chat_session.title == "New Conversation" and len(content) > 0:
            chat_session.title = content[:50] + ('...' if len(content) > 50 else '')

        db.session.commit()

        return jsonify({
            'success': True,
            'user_message': {
                'id': user_message.id,
                'content': user_message.content,
                'type': user_message.message_type,
                'created_at': user_message.created_at.isoformat()
            },
            'ai_message': {
                'id': ai_message.id,
                'content': ai_message.content,
                'type': ai_message.message_type,
                'severity': ai_message.severity_level,
                'created_at': ai_message.created_at.isoformat()
            },
            'session_title': chat_session.title
        })

    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/upload-image', methods=['POST'])
@login_required
def upload_image():
    """API route to upload an image for analysis"""
    session_id = session.get('active_session_id')
    if not session_id:
        return jsonify({'success': False, 'error': 'No active session'}), 400

    chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first()
    if not chat_session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404

    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No image selected'}), 400

    if not allowed_image_file(file.filename):
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400

    try:
        # Generate unique filename
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Convert image to base64 for AI analysis
        file.seek(0)
        image_data = file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')

        # Save user message with image
        user_message = ChatMessage(
            session_id=session_id,
            is_user=True,
            content="Image uploaded for analysis",
            message_type='image',
            image_path=filepath
        )
        db.session.add(user_message)
        db.session.commit()

        # Analyze image using OpenAI Vision
        analysis_result = analyze_image(base64_image)

        # Generate health-specific response
        health_context = f"Based on the image analysis: {analysis_result}"
        ai_response = generate_health_response(health_context)

        # Determine severity level (placeholder logic, would be more sophisticated in production)
        severity_indicators = ["urgent", "emergency", "severe", "critical", "immediate attention"]
        severity_level = 0
        for indicator in severity_indicators:
            if indicator in analysis_result.lower() or indicator in ai_response.lower():
                severity_level = 3  # High severity
                break

        # Add emergency information for severe cases (level 3)
        if severity_level == 3:
            emergency_info = """

**EMERGENCY CONTACT INFORMATION (INDIA):**
- **National Emergency Number:** 112
- **Ambulance:** 108 or 102
- **Medical Helpline:** 104
- **COVID-19 Helpline:** 1075
- **Women Helpline:** 1091

**Please seek immediate medical attention for serious symptoms.**
"""
            ai_response += emergency_info

        # Save AI response
        ai_message = ChatMessage(
            session_id=session_id,
            is_user=False,
            content=ai_response,
            message_type='text',
            health_analysis=analysis_result,
            severity_level=severity_level
        )
        db.session.add(ai_message)

        # Update session title if it's the default title
        if chat_session.title == "New Conversation":
            chat_session.title = "Image Analysis"

        db.session.commit()

        return jsonify({
            'success': True,
            'user_message': {
                'id': user_message.id,
                'type': user_message.message_type,
                'image_path': filepath,
                'created_at': user_message.created_at.isoformat()
            },
            'ai_message': {
                'id': ai_message.id,
                'content': ai_message.content,
                'type': ai_message.message_type,
                'severity': ai_message.severity_level,
                'created_at': ai_message.created_at.isoformat()
            },
            'session_title': chat_session.title
        })

    except Exception as e:
        logger.error(f"Error in upload_image: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/send-audio', methods=['POST'])
@login_required
def send_audio():
    """API route to send audio for transcription and analysis"""
    session_id = session.get('active_session_id')
    if not session_id:
        return jsonify({'success': False, 'error': 'No active session'}), 400

    chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first()
    if not chat_session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404

    # Check if the post request has the audio file part
    if 'audio' not in request.files:
        # If no file was uploaded, check for base64 audio data
        audio_data = request.json.get('audio_data')
        if not audio_data:
            return jsonify({'success': False, 'error': 'No audio provided'}), 400

        # Convert base64 to file
        audio_data = audio_data.split(',')[1] if ',' in audio_data else audio_data
        audio_bytes = base64.b64decode(audio_data)

        # Save to temporary file
        filename = f"{uuid.uuid4()}.wav"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        with open(filepath, 'wb') as f:
            f.write(audio_bytes)
    else:
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No audio selected'}), 400

        if not allowed_audio_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400

        # Generate unique filename
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

    try:
        # Transcribe audio
        transcript = transcribe_audio(filepath)

        # Set default message content if transcription failed
        message_content = transcript
        if not transcript or transcript.startswith("Could not transcribe") or transcript.startswith("Audio unclear") or transcript.startswith("Unable to connect"):
            message_content = "Could not transcribe audio clearly"

        # Save user message with audio and transcript
        user_message = ChatMessage(
            session_id=session_id,
            is_user=True,
            content=message_content,
            message_type='voice',
            audio_path=filepath
        )
        db.session.add(user_message)
        db.session.commit()

        if not transcript or transcript.startswith("Could not transcribe") or transcript.startswith("Audio unclear") or transcript.startswith("Unable to connect"):
            return jsonify({
                'success': True,
                'user_message': {
                    'id': user_message.id,
                    'content': message_content,
                    'type': user_message.message_type,
                    'audio_path': filepath,
                    'created_at': user_message.created_at.isoformat()
                }
            })

        # Generate AI response based on transcript
        health_analysis = analyze_health_question(transcript)
        ai_response = generate_health_response(transcript)

        # Determine severity level
        severity_level = health_analysis.get('severity', 0)

        # Add emergency information for severe cases (level 3)
        if severity_level == 3 or health_analysis.get('emergency', False):
            emergency_info = """

**EMERGENCY CONTACT INFORMATION (INDIA):**
- **National Emergency Number:** 112
- **Ambulance:** 108 or 102
- **Medical Helpline:** 104
- **COVID-19 Helpline:** 1075
- **Women Helpline:** 1091

**Please seek immediate medical attention for serious symptoms.**
"""
            ai_response += emergency_info

        # For moderate concern, add general helpline information
        elif severity_level == 2:
            helpline_info = """

**HEALTH HELPLINE INFORMATION (INDIA):**
- **Medical Helpline:** 104
- **COVID-19 Helpline:** 1075
- **Mental Health Helpline:** 1800-599-0019
"""
            ai_response += helpline_info

        # Save AI response
        ai_message = ChatMessage(
            session_id=session_id,
            is_user=False,
            content=ai_response,
            message_type='text',
            health_analysis=str(health_analysis),
            severity_level=severity_level
        )
        db.session.add(ai_message)

        # Update session title if it's the default title
        if chat_session.title == "New Conversation" and transcript:
            chat_session.title = transcript[:50] + ('...' if len(transcript) > 50 else '')

        db.session.commit()

        return jsonify({
            'success': True,
            'user_message': {
                'id': user_message.id,
                'content': user_message.content,
                'type': user_message.message_type,
                'audio_path': filepath,
                'created_at': user_message.created_at.isoformat()
            },
            'ai_message': {
                'id': ai_message.id,
                'content': ai_message.content,
                'type': ai_message.message_type,
                'severity': ai_message.severity_level,
                'created_at': ai_message.created_at.isoformat()
            },
            'transcript': transcript,
            'session_title': chat_session.title
        })

    except Exception as e:
        logger.error(f"Error in send_audio: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health-journal/add', methods=['POST'])
@login_required
def add_health_log():
    """API route to add a health log entry"""
    data = request.json

    if not data.get('symptom'):
        return jsonify({'success': False, 'error': 'Symptom is required'}), 400

    try:
        log = HealthLog(
            user_id=current_user.id,
            symptom=data.get('symptom'),
            severity=data.get('severity', 5),
            description=data.get('description', '')
        )
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'success': True,
            'log': {
                'id': log.id,
                'symptom': log.symptom,
                'severity': log.severity,
                'description': log.description,
                'recorded_at': log.recorded_at.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Error in add_health_log: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health-journal/delete/<int:log_id>', methods=['POST'])
@login_required
def delete_health_log(log_id):
    """API route to delete a health log entry"""
    log = HealthLog.query.filter_by(id=log_id, user_id=current_user.id).first_or_404()

    try:
        db.session.delete(log)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Health log deleted successfully'
        })

    except Exception as e:
        logger.error(f"Error in delete_health_log: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/images/<path:filename>')
@login_required
def uploaded_image(filename):
    """Route to serve uploaded files (images and audio)"""
    # Remove any path prefixes
    clean_filename = os.path.basename(filename)
    return send_from_directory(app.config['UPLOAD_FOLDER'], clean_filename)

@app.route('/export-data')
@login_required
def export_data():
    """Generate and download a user's health data in JSON format"""
    try:
        # Gather user data
        user_data = {
            'user_info': {
                'username': current_user.username,
                'email': current_user.email,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'date_of_birth': current_user.date_of_birth.isoformat() if current_user.date_of_birth else None,
                'gender': current_user.gender,
                'created_at': current_user.created_at.isoformat()
            },
            'health_logs': [],
            'chat_sessions': []
        }

        # Get health logs
        health_logs = HealthLog.query.filter_by(user_id=current_user.id).all()
        for log in health_logs:
            user_data['health_logs'].append({
                'id': log.id,
                'symptom': log.symptom,
                'severity': log.severity,
                'description': log.description,
                'recorded_at': log.recorded_at.isoformat()
            })

        # Get chat sessions and messages
        chat_sessions = ChatSession.query.filter_by(user_id=current_user.id).all()
        for session in chat_sessions:
            session_data = {
                'id': session.id,
                'title': session.title,
                'created_at': session.created_at.isoformat(),
                'messages': []
            }

            messages = ChatMessage.query.filter_by(session_id=session.id).order_by(ChatMessage.created_at).all()
            for message in messages:
                message_data = {
                    'id': message.id,
                    'is_user': message.is_user,
                    'content': message.content,
                    'message_type': message.message_type,
                    'health_analysis': message.health_analysis,
                    'severity_level': message.severity_level,
                    'created_at': message.created_at.isoformat()
                }
                session_data['messages'].append(message_data)

            user_data['chat_sessions'].append(session_data)

        # Create JSON response with appropriate headers for download
        response = jsonify(user_data)
        response.headers.set('Content-Disposition', 'attachment', filename='health_data.json')
        return response

    except Exception as e:
        logger.error(f"Error in export_data: {str(e)}")
        flash('Failed to export data. Please try again.', 'danger')
        return redirect(url_for('profile'))

@app.route('/api/metrics/log', methods=['POST'])
@login_required
def log_metrics():
    """API endpoint to log performance metrics"""
    try:
        data = request.json
        logger.info(f"Performance Metric - {data['label']}: {data['duration']}ms")

        # Store metrics in database for analysis
        metric = PerformanceMetric(
            label=data['label'],
            duration=data['duration'],
            user_id=current_user.id
        )
        db.session.add(metric)
        db.session.commit()

        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error logging metrics: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health')
@app.route('/admin')
@login_required
def admin_dashboard():
    """Admin dashboard for monitoring security and scaling"""
    # Only allow admin users
    if not current_user.is_authenticated or current_user.email != os.environ.get('ADMIN_EMAIL'):
        flash('Access denied', 'danger')
        return redirect(url_for('dashboard'))

    # Get audit logs
    audit_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()

    # Get server metrics
    server_metrics = load_balancer.get_metrics()

    return render_template('admin.html',
                         audit_logs=audit_logs,
                         server_metrics=server_metrics)

def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Check database connection
        db.session.execute(db.text('SELECT 1'))

        # Check Groq API
        groq_api_key = os.environ.get('GROQ_API_KEY')
        if groq_api_key:
            response = requests.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {groq_api_key}"}
            )
            groq_status = response.status_code == 200
        else:
            groq_status = False

        return jsonify({
            'status': 'healthy',
            'database': True,
            'groq_api': groq_status,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/health-analytics')
@login_required
def health_analytics():
    """Advanced health analytics dashboard with AI-powered insights"""
    return render_template('health-analytics.html')

@app.route('/api/health/smart-analysis', methods=['POST'])
@login_required
def smart_symptom_analysis():
    """Smart symptom analysis endpoint"""
    try:
        # Get user's health logs
        health_logs = HealthLog.query.filter_by(user_id=current_user.id).all()
        logs_data = [{
            'symptom': log.symptom,
            'severity': log.severity,
            'description': log.description,
            'recorded_at': log.recorded_at.isoformat()
        } for log in health_logs]

        # Analyze patterns
        analysis = analyze_symptoms_patterns(logs_data)

        return jsonify({
            'success': True,
            'analysis': analysis
        })
    except Exception as e:
        logger.error(f"Error in smart analysis: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health/visual-analysis', methods=['POST'])
@login_required
def visual_symptom_analysis():
    """Visual symptom analysis with history"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No image selected'}), 400

        if not allowed_image_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400

        # Get symptom history
        symptom_history = HealthLog.query.filter_by(
            user_id=current_user.id
        ).order_by(HealthLog.recorded_at.desc()).limit(5).all()

        history_data = [{
            'date': log.recorded_at.isoformat(),
            'description': log.description,
            'symptom': log.symptom,
            'severity': log.severity
        } for log in symptom_history]

        # Convert image to base64
        image_data = file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')

        # Analyze image with history
        analysis = analyze_image_with_history(base64_image, history_data)

        return jsonify({
            'success': True,
            'analysis': analysis
        })
    except Exception as e:
        logger.error(f"Error in visual analysis: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500



@app.route('/api/health-analytics/data')
@login_required
def health_analytics_data():
    """API endpoint to fetch health analytics data"""
    try:
        # Fetch user's health logs
        health_logs = HealthLog.query.filter_by(user_id=current_user.id).all()
        logs_data = []

        for log in health_logs:
            logs_data.append({
                'id': log.id,
                'symptom': log.symptom,
                'severity': log.severity,
                'description': log.description,
                'recorded_at': log.recorded_at.isoformat()
            })

        # Get user's chat interactions
        chat_sessions = ChatSession.query.filter_by(user_id=current_user.id).all()
        messages_count = 0
        for session in chat_sessions:
            messages_count += ChatMessage.query.filter_by(session_id=session.id).count()

        # Calculate days of usage
        days_of_usage = 0
        if current_user.created_at:
            days_of_usage = (datetime.datetime.utcnow() - current_user.created_at).days

        return jsonify({
            'success': True,
            'health_logs': logs_data,
            'interactions_count': messages_count,
            'days_of_usage': days_of_usage,
            'trends': {
                'improving': len(logs_data) > 0
            }
        })

    except Exception as e:
        logger.error(f"Error fetching health analytics data: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health-analytics/sentiment')
@login_required
def health_sentiment_data():
    """API endpoint to fetch sentiment analysis data"""
    try:
        # This would be more sophisticated in a production app
        # Here we're generating sample data based on actual user messages

        chat_messages = ChatMessage.query.join(
            ChatSession, ChatSession.id == ChatMessage.session_id
        ).filter(
            ChatSession.user_id == current_user.id,
            ChatMessage.is_user == True
        ).order_by(ChatMessage.created_at).all()

        sentiments = []

        # Generate sentiment data from actual messages
        for message in chat_messages:
            # Simple sentiment estimation (would use ML in production)
            sentiment_score = 0

            # Positive indicators
            positive_words = ['better', 'good', 'great', 'improving', 'happy', 'relieved']
            for word in positive_words:
                if word in message.content.lower():
                    sentiment_score += 0.2

            # Negative indicators
            negative_words = ['worse', 'bad', 'pain', 'hurts', 'suffering', 'worried']
            for word in negative_words:
                if word in message.content.lower():
                    sentiment_score -= 0.2

            # Cap at -1 to 1 range
            sentiment_score = max(-1, min(1, sentiment_score))

            sentiments.append({
                'date': message.created_at.isoformat(),
                'score': sentiment_score
            })

        return jsonify({
            'success': True,
            'sentiments': sentiments
        })

    except Exception as e:
        logger.error(f"Error fetching sentiment data: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health-analytics/predictions')
@login_required
def health_predictions():
    """API endpoint to fetch health predictions"""
    try:
        # This would involve ML models in a production environment
        # Here we're generating insights based on actual user data

        # Get health logs
        health_logs = HealthLog.query.filter_by(user_id=current_user.id).all()

        # Default predictions if not enough data
        if len(health_logs) < 2:
            return jsonify({
                'success': True,
                'predictions': [
                    {
                        'label': 'Insufficient Data',
                        'description': 'Continue logging your health symptoms to receive personalized predictions.',
                        'confidence': None,
                        'trend': 'stable'
                    }
                ]
            })

        # Get unique symptoms
        symptoms = {}
        for log in health_logs:
            if log.symptom not in symptoms:
                symptoms[log.symptom] = []
            symptoms[log.symptom].append({
                'severity': log.severity,
                'date': log.recorded_at
            })

        predictions = []

        # Analyze each symptom
        for symptom, data in symptoms.items():
            # Sort by date
            data.sort(key=lambda x: x['date'])

            # Need at least 2 data points for a trend
            if len(data) >= 2:
                first_severity = data[0]['severity']
                last_severity = data[-1]['severity']

                trend = 'stable'
                if last_severity < first_severity:
                    trend = 'improving'
                elif last_severity > first_severity:
                    trend = 'worsening'

                # Generate prediction
                if trend == 'improving':
                    predictions.append({
                        'label': f'{symptom} Improvement',
                        'description': f'Your {symptom.lower()} has shown improvement over time.',
                        'confidence': 0.7,
                        'trend': 'improving'
                    })
                elif trend == 'worsening':
                    predictions.append({
                        'label': f'{symptom} Monitoring',
                        'description': f'Your {symptom.lower()} may require closer monitoring.',
                        'confidence': 0.65,
                        'trend': 'worsening'
                    })

        # Add a general observation if we have enough data points
        if len(health_logs) >= 5:
            # Calculate average severity
            avg_severity = sum(log.severity for log in health_logs) / len(health_logs)

            if avg_severity < 4:
                predictions.append({
                    'label': 'General Wellness',
                    'description': 'Your overall health indicators are positive.',
                    'confidence': 0.8,
                    'trend': 'stable'
                })
            elif avg_severity < 7:
                predictions.append({
                    'label': 'Health Management',
                    'description': 'Consider discussing recurring symptoms with a healthcare provider.',
                    'confidence': 0.75,
                    'trend': 'stable'
                })

        return jsonify({
            'success': True,
            'predictions': predictions
        })

    except Exception as e:
        logger.error(f"Error generating health predictions: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/delete-account', methods=['POST'])
@login_required
def delete_account():
    """Delete a user's account and all associated data"""
    try:
        # Delete all associated data
        ChatMessage.query.filter(
            ChatMessage.session_id.in_(
                db.session.query(ChatSession.id).filter_by(user_id=current_user.id)
            )
        ).delete(synchronize_session=False)

        ChatSession.query.filter_by(user_id=current_user.id).delete(synchronize_session=False)
        HealthLog.query.filter_by(user_id=current_user.id).delete(synchronize_session=False)

        # Get user ID for logout
        user_id = current_user.id

        # Logout the user
        logout_user()

        # Delete the user
        User.query.filter_by(id=user_id).delete()
        db.session.commit()

        flash('Your account has been successfully deleted.', 'success')
        return redirect(url_for('landing'))

    except Exception as e:
        logger.error(f"Error in delete_account: {str(e)}")
        flash('Failed to delete account. Please try again.', 'danger')
        return redirect(url_for('profile'))