// chat.js - Handle chat interactions and session management

document.addEventListener('DOMContentLoaded', function() {
  // Chat elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatContainer = document.querySelector('.chat-container');
  const newSessionBtn = document.getElementById('new-session-btn');

  // If we're on the chat page
  if (chatForm && chatInput && chatContainer) {
    // Submit the chat form
    chatForm.addEventListener('submit', function(event) {
      event.preventDefault();

      const message = chatInput.value.trim();
      if (message) {
        sendChatMessage(message);
        chatInput.value = '';
      }
    });

    // Create a new session
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', createNewSession);
    }

    // Set up session item click handlers
    setupSessionHandlers();

    // Scroll chat to bottom on load
    scrollChatToBottom();
  }
});

// Function to send a chat message
function sendChatMessage(message) {
  // Show loading state in the chat
  const chatContainer = document.querySelector('.chat-container');
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'message user-message loading';
  loadingMessage.innerHTML = `
    <div class="message-avatar">
      <i class="bi bi-person-fill"></i>
    </div>
    <div class="message-content">
      <p class="message-text">${message}</p>
      <div class="message-time">Sending...</div>
    </div>
  `;
  chatContainer.appendChild(loadingMessage);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Send the message to the server
  fetch('/api/chat/send-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message
    })
  })
  .then(response => response.json())
  .then(data => {
    // Remove loading message
    loadingMessage.remove();

    if (data.success) {
      // Update chat with message and response
      updateChatWithMessage(data);

      // Update session title if needed
      if (data.session_title) {
        updateSessionTitle(data.session_title);
      }
    } else {
      showError(data.error || 'Failed to send message. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);

    // Remove loading message
    loadingMessage.remove();

    showError('Failed to send message. Please check your connection and try again.');
  });
}

// Function to format text with proper styling (bold, etc.)
function formatMessageText(text) {
  if (!text) return '';

  // Replace **text** with <strong>text</strong> for proper bold formatting
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Function to add Read Aloud button to AI messages
function addReadAloudButton(container, text) {
  const readAloudBtn = document.createElement('button');
  readAloudBtn.className = 'btn btn-sm btn-outline-primary read-aloud-btn mt-2';
  readAloudBtn.innerHTML = '<i class="bi bi-volume-up"></i> Read Aloud';

  let isSpeaking = false;
  let utterance = null;

  readAloudBtn.addEventListener('click', function() {
    if (!isSpeaking) {
      // Start speaking
      const plainText = text.replace(/\*\*/g, ''); // Remove asterisks
      utterance = new SpeechSynthesisUtterance(plainText);

      // Visual indicator that it's reading
      this.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
      isSpeaking = true;

      // When finished speaking
      utterance.onend = () => {
        this.innerHTML = '<i class="bi bi-volume-up"></i> Read Aloud';
        isSpeaking = false;
        utterance = null;
      };

      // In case of error
      utterance.onerror = () => {
        this.innerHTML = '<i class="bi bi-volume-up"></i> Read Aloud';
        isSpeaking = false;
        utterance = null;
      };

      speechSynthesis.speak(utterance);
    } else {
      // Pause speaking
      speechSynthesis.pause();
      this.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
      isSpeaking = false;
    }
  });

  container.appendChild(readAloudBtn);
}

// Function to update chat with message and AI response
function updateChatWithMessage(data) {
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
      <p class="message-text">${data.user_message.content}</p>
      <div class="message-time">${formatDateTime(data.user_message.created_at)}</div>
    </div>
  `;

  // Append user message to chat
  chatContainer.appendChild(userMessage);

  // Create AI response element
  if (data.ai_message) {
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai-message';

    let severityIndicator = '';
    if (data.ai_message.severity > 0) {
      const severityClass = data.ai_message.severity >= 3 ? 'severity-high' : 
                           (data.ai_message.severity >= 2 ? 'severity-medium' : 'severity-low');
      severityIndicator = `<span class="severity-indicator ${severityClass}"></span>`;
    }

    // Format the content with proper styling (bold text)
    const formattedContent = formatMessageText(data.ai_message.content);

    // Add emergency helpline information for high severity cases
    let emergencyInfo = '';
    if (data.ai_message.severity >= 3) {
      emergencyInfo = `
        <div class="emergency-info alert alert-danger mt-2">
          <strong>Emergency Information:</strong>
          <p>For medical emergencies in India, contact:</p>
          <ul>
            <li>National Emergency Number: <strong>112</strong></li>
            <li>Ambulance: <strong>108</strong></li>
            <li>Medical Helpline: <strong>104</strong></li>
          </ul>
        </div>
      `;
    }

    aiMessage.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-robot"></i>
      </div>
      <div class="message-content">
        <p class="message-text">${formattedContent}</p>
        ${emergencyInfo}
        <div class="message-time">${severityIndicator}${formatDateTime(data.ai_message.created_at)}</div>
      </div>
    `;

    // Append AI message to chat
    chatContainer.appendChild(aiMessage);

    // Add Read Aloud button to the message content
    const messageContent = aiMessage.querySelector('.message-content');
    addReadAloudButton(messageContent, data.ai_message.content);
  }

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Function to create a new chat session
function createNewSession() {
  // Show loading state
  const newSessionBtn = document.getElementById('new-session-btn');
  showLoading(newSessionBtn, 'Creating...');

  // Make API request
  fetch('/api/chat/new-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    // Hide loading state
    hideLoading(newSessionBtn);

    if (data.success) {
      // Redirect to reload the page with the new session
      window.location.href = '/dashboard';
    } else {
      showError(data.error || 'Failed to create new session');
    }
  })
  .catch(error => {
    console.error('Error creating session:', error);
    hideLoading(newSessionBtn);
    showError('Failed to create new session. Please try again.');
  });
}

// Function to set up session click handlers
function setupSessionHandlers() {
  // Session item click
  document.querySelectorAll('.session-item').forEach(item => {
    // Select session
    item.addEventListener('click', function(event) {
      if (!event.target.closest('.session-actions')) {
        const sessionId = this.dataset.sessionId;
        selectSession(sessionId);
      }
    });

    // Rename session
    const renameBtn = item.querySelector('.rename-session-btn');
    if (renameBtn) {
      renameBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        const sessionId = this.closest('.session-item').dataset.sessionId;
        promptRenameSession(sessionId);
      });
    }

    // Delete session
    const deleteBtn = item.querySelector('.delete-session-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        const sessionId = this.closest('.session-item').dataset.sessionId;
        confirmDeleteSession(sessionId);
      });
    }
  });
}

// Function to select a session
function selectSession(sessionId) {
  fetch(`/api/chat/select-session/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Redirect to reload the page with the selected session
      window.location.href = '/dashboard';
    } else {
      showError(data.error || 'Failed to select session');
    }
  })
  .catch(error => {
    console.error('Error selecting session:', error);
    showError('Failed to select session. Please try again.');
  });
}

// Function to prompt for session rename
function promptRenameSession(sessionId) {
  const sessionItem = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
  const currentTitle = sessionItem.querySelector('.session-title').textContent.trim();

  const newTitle = prompt('Enter new session title:', currentTitle);

  if (newTitle !== null && newTitle.trim() !== '') {
    renameSession(sessionId, newTitle);
  }
}

// Function to rename a session
function renameSession(sessionId, title) {
  fetch(`/api/chat/rename-session/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Update session title in the UI
      const sessionItem = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
      if (sessionItem) {
        sessionItem.querySelector('.session-title').textContent = data.title;
      }

      // Update current session title if this is the active session
      if (sessionId === getActiveSessionId()) {
        updateSessionTitle(data.title);
      }
    } else {
      showError(data.error || 'Failed to rename session');
    }
  })
  .catch(error => {
    console.error('Error renaming session:', error);
    showError('Failed to rename session. Please try again.');
  });
}

// Function to confirm session deletion
function confirmDeleteSession(sessionId) {
  if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
    deleteSession(sessionId);
  }
}

// Function to delete a session
function deleteSession(sessionId) {
  fetch(`/api/chat/delete-session/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // If this was the active session, reload the page
      if (data.new_session_id) {
        window.location.href = '/dashboard';
      } else {
        // Otherwise just remove the session from the sidebar
        const sessionItem = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
        if (sessionItem) {
          sessionItem.remove();
        }
      }
    } else {
      showError(data.error || 'Failed to delete session');
    }
  })
  .catch(error => {
    console.error('Error deleting session:', error);
    showError('Failed to delete session. Please try again.');
  });
}

// Function to get active session ID
function getActiveSessionId() {
  const activeSession = document.querySelector('.session-item.active');
  return activeSession ? activeSession.dataset.sessionId : null;
}

// Function to update session title
function updateSessionTitle(title) {
  const sessionTitleElem = document.getElementById('current-session-title');
  if (sessionTitleElem) {
    sessionTitleElem.textContent = title;
  }
}

// Function to scroll chat to bottom
function scrollChatToBottom() {
  const chatContainer = document.querySelector('.chat-container');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

let currentUtterance = null;

function readText(text) {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  utterance.onend = () => {
    currentUtterance = null;
    const readButton = document.querySelector('.read-aloud-btn');
    readButton.innerHTML = '<i class="bi bi-volume-up"></i>';
  };

  const readButton = document.querySelector('.read-aloud-btn');
  readButton.innerHTML = '<i class="bi bi-pause-fill"></i>';

  readButton.onclick = () => {
    if (window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        readButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
      } else {
        window.speechSynthesis.pause();
        readButton.innerHTML = '<i class="bi bi-play-fill"></i>';
      }
    }
  };

  window.speechSynthesis.speak(utterance);
}