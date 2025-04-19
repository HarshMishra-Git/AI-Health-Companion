import os
import json
import base64
import logging
import tempfile
import subprocess
from typing import Optional, Tuple
from pydub import AudioSegment

import requests
import speech_recognition as sr

logger = logging.getLogger(__name__)

# Groq API information
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama3-8b-8192"  # Default model

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribe audio file using Groq's language model or local fallback
    
    Args:
        audio_file_path: Path to the audio file
    
    Returns:
        Transcribed text
    """
    # First, ensure we have a valid WAV file that can be used
    fixed_audio_path = preprocess_audio(audio_file_path)
    if not fixed_audio_path:
        logger.error("Failed to preprocess audio file")
        return "Could not process audio file. Please try again with a different recording."
    
    # Try Groq API for transcription if key is available
    if GROQ_API_KEY:
        try:
            # Convert audio to base64
            with open(fixed_audio_path, "rb") as audio_file:
                audio_bytes = audio_file.read()
                base64_audio = base64.b64encode(audio_bytes).decode('utf-8')
            
            return transcribe_with_groq(base64_audio, fixed_audio_path)
        except Exception as e:
            logger.error(f"Error with Groq transcription: {str(e)}")
            logger.info("Falling back to local speech recognition")
    
    # Fallback to local speech recognition
    try:
        return transcribe_locally(fixed_audio_path)
    except Exception as e:
        logger.error(f"Error with local transcription: {str(e)}")
        return "Could not transcribe audio clearly. Please try again."

def preprocess_audio(audio_file_path: str) -> str:
    """
    Preprocess audio file to ensure it's in a compatible format
    
    Args:
        audio_file_path: Path to the audio file
    
    Returns:
        Path to the preprocessed audio file
    """
    try:
        # Create a temporary WAV file
        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        
        # Use ffmpeg to convert and normalize the audio
        command = [
            'ffmpeg', '-y', '-i', audio_file_path,
            '-ar', '16000',  # Sample rate
            '-ac', '1',      # Mono channel
            '-c:a', 'pcm_s16le',  # PCM 16-bit encoding
            temp_wav
        ]
        
        subprocess.run(command, check=True, capture_output=True)
        logger.info(f"Successfully preprocessed audio to {temp_wav}")
        
        # Validate the created file
        try:
            audio = AudioSegment.from_wav(temp_wav)
            if len(audio) == 0:
                logger.error("Generated WAV file has zero length")
                return None
        except Exception as e:
            logger.error(f"Error validating processed WAV file: {str(e)}")
            return None
            
        return temp_wav
        
    except Exception as e:
        logger.error(f"Error preprocessing audio: {str(e)}")
        return None

def transcribe_with_groq(base64_audio: str, audio_file_path: str) -> str:
    """
    Use Groq LLM to analyze the audio content
    
    Args:
        base64_audio: Base64 encoded audio data
        audio_file_path: Path to the audio file (as fallback)
        
    Returns:
        Transcribed text
    """
    # First try Google speech recognition for faster results
    local_transcript = ""
    try:
        local_transcript = transcribe_locally(audio_file_path)
        if local_transcript and not local_transcript.startswith("Could not") and not local_transcript.startswith("Audio unclear"):
            logger.info("Successfully transcribed with Google Speech Recognition")
            return local_transcript
    except Exception as e:
        logger.error(f"Error in local transcription fallback: {str(e)}")
    
    # If Google fails, try with Groq LLM
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        }
        
        # Create a system prompt for audio transcription
        system_message = """
        You are an advanced audio transcription system. Your task is to:
        1. Listen to the audio data
        2. Transcribe the spoken content accurately
        3. Identify key medical terms or symptoms mentioned
        4. Return only the transcribed text without any additional commentary
        
        If the audio isn't clear, make your best attempt and indicate uncertainty with [?].
        """
        
        # We'll describe the audio as an encoded file
        user_message = f"""
        This is a base64-encoded audio file. 
        The person is likely talking about health symptoms or asking a medical question.
        Please transcribe the content as accurately as possible.
        """
        
        data = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.2,
            "max_tokens": 300
        }
        
        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        transcript = result["choices"][0]["message"]["content"].strip()
        
        # Clean up the transcript
        transcript = transcript.replace('Transcript:', '').replace('[Transcript]:', '').strip()
        if "I cannot transcribe" in transcript or "cannot process" in transcript:
            # If Groq says it can't process the audio, fall back to local result or error
            return local_transcript or "Could not transcribe audio clearly. Please try speaking more clearly."
            
        return transcript
        
    except Exception as e:
        logger.error(f"Error with Groq transcription: {str(e)}")
        # Return local transcript if it exists, otherwise error message
        return local_transcript or "Could not transcribe audio clearly. Please try again."

def transcribe_locally(audio_file_path: str) -> str:
    """
    Transcribe audio using local speech recognition via Google's API
    
    Args:
        audio_file_path: Path to the audio file
    
    Returns:
        Transcribed text
    """
    recognizer = sr.Recognizer()
    
    try:
        with sr.AudioFile(audio_file_path) as source:
            # Adjust for ambient noise and increase sensitivity
            recognizer.adjust_for_ambient_noise(source)
            recognizer.energy_threshold = 50  # Lower threshold for better sensitivity
            recognizer.dynamic_energy_threshold = True
            
            # Record audio with longer timeout for patience
            audio_data = recognizer.record(source)
            
            try:
                # Try Google's speech recognition
                text = recognizer.recognize_google(audio_data)
                if text:
                    return text
                else:
                    return "Could not detect speech in the audio."
            except sr.UnknownValueError:
                logger.error("Google Speech Recognition could not understand audio")
                return "Audio unclear. Please try speaking more clearly."
            except sr.RequestError as e:
                logger.error(f"Could not request results from Google Speech Recognition service: {str(e)}")
                return "Unable to connect to speech recognition service."
    except Exception as e:
        logger.error(f"Error processing audio file: {str(e)}")
        return "Could not process audio file. Please try a different recording."
