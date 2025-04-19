import os
import base64
import logging
from typing import Dict, Any, Optional, List, Union

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure the Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Default model to use for image analysis
DEFAULT_MODEL = "gemini-1.5-flash"

def analyze_image_with_history(base64_image: str, symptom_history: List[Dict] = None) -> Dict[str, Any]:
    """
    Analyze a medical image with historical context using Gemini Vision
    """
    if not GEMINI_API_KEY:
        return {"error": "API key not found"}
    
    try:
        image_data = base64.b64decode(base64_image)
        
        # Build context from history
        history_context = ""
        if symptom_history:
            history_context = "Previous symptoms and images:\n" + \
                            "\n".join([f"- {h['date']}: {h['description']}" for h in symptom_history])
        
        prompt = f"""
        Analyze this medical image in detail:
        1. Identify visible symptoms and characteristics
        2. Compare with previous records if available
        3. Note any significant changes
        4. Suggest potential medical terms
        5. Recommend if professional evaluation is needed
        
        Historical Context:
        {history_context}
        
        Provide structured analysis in medical terminology.
        """
        
        generation_config = {
            "temperature": 0.4,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1000,
        }
        
        model = genai.GenerativeModel(
            model_name=DEFAULT_MODEL,
            generation_config=generation_config
        )
        
        content_parts = [
            prompt,
            {"mime_type": "image/jpeg", "data": image_data}
        ]
        
        response = model.generate_content(content_parts)
        
        # Structure the response
        analysis = {
            "analysis": response.text,
            "timestamp": datetime.now().isoformat(),
            "requires_attention": any(term in response.text.lower() for term in 
                ["urgent", "severe", "immediate", "concerning"]),
            "medical_terms": extract_medical_terms(response.text)
        }
        
        return analysis
    except Exception as e:
        logger.error(f"Error in image analysis: {str(e)}")
        return {"error": str(e)}

def extract_medical_terms(text: str) -> List[str]:
    """Extract medical terminology from text"""
    # This would ideally use a medical terminology database
    # For now, we'll use basic pattern matching
    common_terms = [
        "acute", "chronic", "lesion", "inflammation",
        "edema", "erythema", "papule", "nodule"
    ]
    return [term for term in common_terms if term.lower() in text.lower()]

def analyze_image(base64_image: str) -> str:
    """
    Analyze a medical image using Google's Gemini Vision capabilities
    
    Args:
        base64_image: Base64 encoded image
    
    Returns:
        Analysis result
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not found in environment variables")
        return "Image analysis is unavailable. API key not configured."
    
    try:
        # Decode base64 image
        image_data = base64.b64decode(base64_image)
        
        # Configure Gemini model
        generation_config = {
            "temperature": 0.4,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 800,
        }
        
        model = genai.GenerativeModel(
            model_name=DEFAULT_MODEL,
            generation_config=generation_config
        )
        
        # Create prompt for medical image analysis
        prompt = """
        Analyze this medical image in detail and describe what you observe. 
        If you see any potential health concerns, describe them objectively.
        Focus on visible symptoms or conditions that might be present.
        Do not make definitive diagnoses, but you can mention possible conditions
        that a healthcare professional might want to evaluate further.
        If the image appears to show a serious medical condition, note that.
        """
        
        # Prepare content parts (text prompt and image)
        content_parts = [
            prompt,
            {"mime_type": "image/jpeg", "data": image_data}
        ]
        
        # Generate response from Gemini
        response = model.generate_content(content_parts)
        
        # Return the text response
        return response.text
    
    except Exception as e:
        logger.error(f"Error calling Gemini API: {str(e)}")
        return f"I couldn't analyze the image due to a technical issue: {str(e)}"