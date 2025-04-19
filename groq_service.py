import os
import json
import time
import logging
from typing import Dict, Any, Optional, List
import datetime

# Get API key from environment
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
if not GROQ_API_KEY:
    logging.warning("GROQ_API_KEY not found in environment variables")

import requests

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Default model to use
DEFAULT_MODEL = "llama3-8b-8192"

def track_performance(func):
    """Decorator to track function performance"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration = (time.time() - start_time) * 1000  # Convert to ms
            logger.info(f"[Performance] {func.__name__}: {duration:.2f}ms")
            return result
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            logger.error(f"[Performance] {func.__name__} failed after {duration:.2f}ms: {str(e)}")
            raise
    return wrapper

@track_performance
def generate_health_response(prompt: str) -> str:
    """Generate a health-related response using Groq API"""
    if not GROQ_API_KEY:
        return "I'm sorry, I'm not able to process your request at the moment. Please try again later."

    system_message = """You are HealthCompanion, an advanced AI health assistant with the tone and approach of an experienced, empathetic physician.

    Your role is to:
    1. Provide factual health information based on current medical knowledge and evidence-based medicine
    2. Deliver responses with the professionalism and empathy of a real doctor
    3. Use medical terminology appropriately but explain complex concepts in accessible language
    4. Structure recommendations like a clinical consultation
    5. For treatment options, provide a well-structured set of recommendations with rationale

    Response format for symptom queries:
    1. Start with a professional, empathetic acknowledgment
    2. Discuss potential causes with clinical precision
    3. Include well-structured recommendations (use **bold** formatting for key points)
    4. End with appropriate guidance on medical follow-up

    Important guidelines:
    - Use medical terminology appropriately but explain complex concepts
    - Format key points and recommendations with **bold text** for emphasis
    - For moderate to severe symptoms, include specific Indian emergency numbers (108 for ambulance)
    - Use numbered or bulleted lists for step-by-step recommendations
    - Include specific self-care approaches when appropriate
    - Maintain a professional but warm tone like an experienced physician
    - Always note the limitations of virtual assessment
    - For serious symptoms, emphasize the importance of in-person evaluation

    CRITICAL: Your responses should sound like they come from a qualified, experienced physician who is both knowledgeable and compassionate.
    """

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        }

        data = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 800
        }

        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()

        result = response.json()
        return result["choices"][0]["message"]["content"]

    except Exception as e:
        logger.error(f"Error in generate_health_response: {str(e)}")
        return "I apologize, but I encountered an error processing your request. Please try again."

def analyze_symptoms_patterns(logs_data: List[Dict]) -> Dict[str, Any]:
    """Analyze patterns in health logs"""
    if not logs_data:
        return {
            "patterns": [{"symptom": "No data available", "description": "Please add some health logs first"}],
            "correlations": ["No correlations found"],
            "recommendations": ["Please add health logs to receive personalized recommendations"]
        }

    try:
        # Format the logs for analysis
        formatted_logs = []
        for log in logs_data:
            formatted_logs.append({
                "symptom": log.get("symptom", ""),
                "severity": log.get("severity", 0),
                "description": log.get("description", ""),
                "date": log.get("recorded_at", "")
            })

        analysis_prompt = f"""
        Analyze these health logs and provide insights in the following format:

        Logs to analyze: {json.dumps(formatted_logs)}

        Please provide a clear analysis in the following format:

        PATTERNS IN SYMPTOMS:
        • List each pattern on a new line
        • Start each point with a bullet point
        • Keep descriptions clear and concise

        SYMPTOM CORRELATIONS:
        • List each correlation on a new line
        • Describe relationships between symptoms
        • Include severity levels when relevant

        RECOMMENDATIONS:
        1. List each recommendation as a numbered point
        2. Start each point on a new line
        3. Make actionable suggestions
        4. Prioritize important recommendations first

        Format in plain text with clear spacing between sections.
        """

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        }

        data = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "user", "content": analysis_prompt}
            ],
            "temperature": 0.3
        }

        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()

        analysis = response.json()["choices"][0]["message"]["content"]

        # Parse the analysis and ensure proper structure
        try:
            result = json.loads(analysis)
            return {
                "patterns": result.get("patterns", []),
                "correlations": result.get("correlations", []),
                "recommendations": result.get("recommendations", [])
            }
        except json.JSONDecodeError:
            # Fallback structure if JSON parsing fails
            return {
                "patterns": [{"symptom": "Analysis completed", "description": analysis}],
                "correlations": ["Analysis completed"],
                "recommendations": ["Based on the analysis: " + analysis]
            }

    except Exception as e:
        logger.error(f"Error in analyze_symptoms_patterns: {str(e)}")
        return {
            "patterns": [{"symptom": "Analysis error", "description": str(e)}],
            "correlations": ["No correlations found"],
            "recommendations": ["Unable to analyze patterns. Please try again."]
        }



def analyze_health_question(prompt: str) -> Dict[str, Any]:
    """Analyze a health question to determine severity and key medical concepts"""
    if not GROQ_API_KEY:
        return {"severity": 0, "keywords": [], "error": "API key not found"}

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        }

        data = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": "You are a medical analyzer. Analyze the health query for severity and key medical concepts."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1
        }

        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()

        analysis = response.json()["choices"][0]["message"]["content"]
        return {
            "severity": 1,  # Default moderate severity
            "keywords": [prompt],  # Basic keyword extraction
            "analysis": analysis
        }

    except Exception as e:
        logger.error(f"Error in analyze_health_question: {str(e)}")
        return {"severity": 0, "keywords": [], "error": str(e)}