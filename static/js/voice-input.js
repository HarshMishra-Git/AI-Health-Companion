// voice-input.js - Handle voice recording and transcription

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingTimeout;
let stream; // Added: Declare stream variable

document.addEventListener('DOMContentLoaded', function() {
  const startRecordingBtn = document.getElementById('start-recording');
  const stopRecordingBtn = document.getElementById('stop-recording');
  const cancelButton = document.getElementById('cancel-recording'); // Added: Get cancel button
  const recordButton = document.getElementById('start-recording'); // Added: Get record button

  // If recording buttons exist in the current page
  if (startRecordingBtn && stopRecordingBtn && cancelButton && recordButton) {
    // Initially hide stop and cancel buttons
    stopRecordingBtn.style.display = 'none';
    cancelButton.style.display = 'none';

    // Start recording when button is clicked
    startRecordingBtn.addEventListener('click', startRecording);

    // Stop recording when button is clicked
    stopRecordingBtn.addEventListener('click', stopRecording);

    // Cancel recording when button is clicked
    cancelButton.addEventListener('click', () => {
      if (mediaRecorder) {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        mediaRecorder = null;
        recordButton.classList.remove('recording');
        recordButton.innerHTML = '<i class="bi bi-mic"></i>';
        cancelButton.style.display = 'none';
        stopRecordingBtn.style.display = 'none'; //Added to hide stop button when cancelled.
        startRecordingBtn.style.display = 'inline-block'; //Added to show start button when cancelled.
      }
    });
  }
});

// Function to start voice recording
async function startRecording() {
  try {
    const startBtn = document.getElementById('start-recording');
    const stopBtn = document.getElementById('stop-recording');
    const cancelBtn = document.getElementById('cancel-recording'); //Added: Get cancel button
    const recordingIndicator = document.getElementById('recording-indicator');

    // Request microphone access
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create media recorder
    mediaRecorder = new MediaRecorder(stream);

    // Clear previous recordings
    audioChunks = [];

    // Set up event handling
    mediaRecorder.addEventListener('dataavailable', event => {
      audioChunks.push(event.data);
    });

    // When recording stops
    mediaRecorder.addEventListener('stop', () => {
      isRecording = false;
      clearTimeout(recordingTimeout);

      // Process the recorded audio
      processAudio();

      // Reset UI
      startBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
      cancelBtn.style.display = 'none'; //Added to hide cancel button when recording stops.
      if (recordingIndicator) recordingIndicator.style.display = 'none';
    });

    // Start recording
    mediaRecorder.start();
    isRecording = true;

    // Update UI
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block'; //Added to show cancel button when recording starts.
    if (recordingIndicator) recordingIndicator.style.display = 'flex';

    // Automatically stop recording after 60 seconds if not stopped manually
    recordingTimeout = setTimeout(() => {
      if (isRecording) {
        stopRecording();
      }
    }, 60000); // 60 seconds

  } catch (error) {
    console.error('Error starting recording:', error);
    showError('Could not access microphone. Please check your settings and try again.');
  }
}

// Function to stop voice recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordButton.classList.remove('recording');
    recordButton.innerHTML = '<i class="bi bi-mic"></i>';
    cancelButton.style.display = 'none';
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    mediaRecorder = null;
  }
}

// Function to process the recorded audio
function processAudio() {
  if (audioChunks.length === 0) {
    showError('No audio recorded. Please try again.');
    return;
  }

  // Convert audio chunks to blob
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

  // Convert blob to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);

  reader.onloadend = function() {
    const base64Audio = reader.result;

    // Show sending indicator
    const chatContainer = document.querySelector('.chat-container');
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'message user-message loading';
    loadingMessage.innerHTML = `
      <div class="message-content">
        <p class="message-text">Sending audio...</p>
      </div>
    `;
    chatContainer.appendChild(loadingMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Send the audio to the server
    sendAudioToServer(base64Audio, loadingMessage);
  };
}

// Function to send audio to the server
function sendAudioToServer(audioData, loadingElement) {
  // Make API request to process audio
  fetch('/api/chat/send-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_data: audioData
    })
  })
  .then(response => response.json())
  .then(data => {
    // Remove loading message
    if (loadingElement) {
      loadingElement.remove();
    }

    if (data.success) {
      // Update chat UI with the transcribed message and AI response
      updateChatWithVoiceMessage(data);

      // Update session title if needed
      if (data.session_title) {
        updateSessionTitle(data.session_title);
      }
    } else {
      showError(data.error || 'Failed to process audio. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error sending audio:', error);

    // Remove loading message
    if (loadingElement) {
      loadingElement.remove();
    }

    showError('Failed to send audio. Please check your connection and try again.');
  });
}

// Function to update chat with voice message
function updateChatWithVoiceMessage(data) {
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) return;

  // Create user message element
  const userMessage = document.createElement('div');
  userMessage.className = 'message user-message';
  userMessage.innerHTML = `
    <div class="message-avatar">
      <i class="bi bi-person-fill"></i>
    </div>
    <div class="message-content">
      <p class="message-text">${data.user_message.content || 'Audio message'}</p>
      <audio controls src="/images/${data.user_message.audio_path.split('/').pop()}" class="mt-2 w-100"></audio>
      <div class="message-time">${formatDateTime(data.user_message.created_at)}</div>
    </div>
  `;

  // Append user message to chat
  chatContainer.appendChild(userMessage);

  // Create AI response element if exists
  if (data.ai_message) {
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai-message';

    let severityIndicator = '';
    if (data.ai_message.severity > 0) {
      const severityClass = data.ai_message.severity >= 3 ? 'severity-high' : 
                           (data.ai_message.severity >= 2 ? 'severity-medium' : 'severity-low');
      severityIndicator = `<span class="severity-indicator ${severityClass}"></span>`;
    }

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
      <p class="message-text">${data.ai_message.content}</p>
      <div class="message-time">${severityIndicator}${formatDateTime(data.ai_message.created_at)}</div>
    `;

    aiMessage.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-robot"></i>
      </div>
    `;
    aiMessage.appendChild(messageContent);
    addReadAloudButton(messageContent, data.ai_message.content);

    // Append AI message to chat
    chatContainer.appendChild(aiMessage);
  }

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}


// Placeholder functions (replace with actual implementations)
function showError(message) {
  console.error(message);
  // Add UI to display error message
}

function updateSessionTitle(title) {
  // Update the session title in the UI
}

function formatDateTime(dateTime) {
    //Format the date and time
    return dateTime;
}

function addReadAloudButton(messageContent, text) {
    //Add the read aloud button to the message content.
}