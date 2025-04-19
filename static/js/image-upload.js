// image-upload.js - Handle image uploads and analysis

document.addEventListener('DOMContentLoaded', function() {
  const imageUploadBtn = document.getElementById('image-upload-btn');
  const imageFileInput = document.getElementById('image-file-input');

  // If image upload elements exist in the current page
  if (imageUploadBtn && imageFileInput) {
    // Setup image upload button click handler
    imageUploadBtn.addEventListener('click', function() {
      imageFileInput.click();
    });

    // Setup file input change handler
    imageFileInput.addEventListener('change', handleImageUpload);
  }

  // Setup drag and drop for the chat container
  const chatContainer = document.querySelector('.chat-container');
  if (chatContainer) {
    chatContainer.addEventListener('dragover', handleDragOver);
    chatContainer.addEventListener('dragleave', handleDragLeave);
    chatContainer.addEventListener('drop', handleDrop);
  }
});

// Function to handle image upload via file input
function handleImageUpload(event) {
  const file = event.target.files[0];

  if (file) {
    // Validate file type
    if (!validateImageFile(file)) {
      showError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
      return;
    }

    // Upload the image
    uploadImage(file);

    // Reset the file input
    event.target.value = '';
  }
}

// Function to handle drag over event
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();

  // Add a visual indicator
  event.currentTarget.classList.add('drag-over');
}

// Function to handle drag leave event
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();

  // Remove visual indicator
  event.currentTarget.classList.remove('drag-over');
}

// Function to handle drop event
function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();

  // Remove visual indicator
  event.currentTarget.classList.remove('drag-over');

  // Get the files from the drop event
  const files = event.dataTransfer.files;

  if (files && files.length > 0) {
    const file = files[0];

    // Validate file type
    if (!validateImageFile(file)) {
      showError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
      return;
    }

    // Upload the image
    uploadImage(file);
  }
}

// Function to validate image file
function validateImageFile(file) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  return validTypes.includes(file.type);
}

// Function to upload image
function uploadImage(file) {
  // Create FormData object
  const formData = new FormData();
  formData.append('image', file);

  // Show loading state in the chat
  const chatContainer = document.querySelector('.chat-container');
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'message user-message loading';
  loadingMessage.innerHTML = `
    <div class="message-content">
      <p class="message-text">Uploading image for analysis...</p>
      <div class="spinner-border spinner-border-sm text-light mt-2" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;
  chatContainer.appendChild(loadingMessage);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Upload the image
  fetch('/api/chat/upload-image', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    // Remove loading message
    loadingMessage.remove();

    if (data.success) {
      // Update chat with image and AI response
      updateChatWithImage(data);

      // Update session title if needed
      if (data.session_title) {
        updateSessionTitle(data.session_title);
      }
    } else {
      showError(data.error || 'Failed to upload image. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error uploading image:', error);

    // Remove loading message
    loadingMessage.remove();

    showError('Failed to upload image. Please check your connection and try again.');
  });
}

// Function to update chat with image and AI response
function updateChatWithImage(data) {
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) return;

  // Create user message with image
  const userMessage = document.createElement('div');
  userMessage.className = 'message user-message';
  userMessage.innerHTML = `
    <div class="message-avatar">
      <i class="bi bi-person-fill"></i>
    </div>
    <div class="message-content">
      <p class="message-text">Image uploaded for analysis</p>
      <div class="image-message">
        <img src="/images/${data.user_message.image_path.split('/').pop()}" alt="Uploaded image">
      </div>
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

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    if (!validateImageFile(file)) {
      showError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
      return;
    }
    uploadImage(file);
    event.target.value = '';
  }
}

document.querySelector('.image-upload-btn').addEventListener('click', handleImageUpload);