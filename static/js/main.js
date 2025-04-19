// main.js - Main JavaScript functionality for the Health Companion app

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Bootstrap popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // Flash message auto-close
  const flashMessages = document.querySelectorAll('.alert-dismissible');
  flashMessages.forEach(function(alert) {
    // Add entrance animation
    alert.style.animation = 'slideInDown 0.5s ease forwards';
    
    setTimeout(function() {
      // Add exit animation
      alert.style.animation = 'slideOutUp 0.5s ease forwards';
      setTimeout(function() {
        const closeButton = alert.querySelector('.btn-close');
        if (closeButton) {
          closeButton.click();
        } else {
          alert.style.display = 'none';
        }
      }, 500);
    }, 5000);
  });

  // Toggle sidebar on mobile with animation
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', function() {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar.classList.contains('sidebar-hidden')) {
        sidebar.classList.remove('sidebar-hidden');
        sidebar.style.animation = 'slideInLeft 0.3s ease forwards';
      } else {
        sidebar.style.animation = 'slideOutLeft 0.3s ease forwards';
        setTimeout(() => {
          sidebar.classList.add('sidebar-hidden');
        }, 300);
      }
    });
  }

  // Setup dark mode toggle functionality
  setupDarkModeToggle();

  // Initialize form validation
  setupFormValidation();
  
  // Add animation to cards
  animateOnScroll();
  
  // Initialize background particles
  initParticles();
});

// Function to setup dark mode toggle
function setupDarkModeToggle() {
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    // Dark mode is enabled by default
    darkModeToggle.addEventListener('click', function() {
      document.body.classList.toggle('light-mode');
      const isDarkMode = !document.body.classList.contains('light-mode');
      
      // Save preference to localStorage
      localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
      
      // Update toggle icon
      updateDarkModeIcon(isDarkMode);
    });
    
    // Check for saved preference
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode === 'disabled') {
      document.body.classList.add('light-mode');
      updateDarkModeIcon(false);
    } else {
      updateDarkModeIcon(true);
    }
  }
}

// Function to update dark mode toggle icon
function updateDarkModeIcon(isDarkMode) {
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    const icon = darkModeToggle.querySelector('i');
    if (icon) {
      if (isDarkMode) {
        icon.classList.remove('bi-sun');
        icon.classList.add('bi-moon');
      } else {
        icon.classList.remove('bi-moon');
        icon.classList.add('bi-sun');
      }
    }
  }
}

// Function to setup form validation
function setupFormValidation() {
  const forms = document.querySelectorAll('.needs-validation');
  
  Array.prototype.slice.call(forms).forEach(function(form) {
    form.addEventListener('submit', function(event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      form.classList.add('was-validated');
    }, false);
  });
}

// Function to format date and time
function formatDateTime(dateTime) {
  const date = new Date(dateTime);
  return date.toLocaleString();
}

// Function to format date only
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Function to show loading state
function showLoading(element, text = 'Loading...') {
  if (!element) return;
  
  // Save original content
  element.dataset.originalContent = element.innerHTML;
  
  // Set loading state
  element.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${text}`;
  element.disabled = true;
}

// Function to hide loading state
function hideLoading(element) {
  if (!element) return;
  
  // Restore original content
  if (element.dataset.originalContent) {
    element.innerHTML = element.dataset.originalContent;
    element.disabled = false;
  }
}

// Function to show error message
function showError(message, container = null) {
  const errorHtml = `
    <div class="alert alert-danger alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  if (container) {
    container.innerHTML = errorHtml;
  } else {
    const mainContent = document.querySelector('.main-content') || document.body;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-container';
    errorDiv.innerHTML = errorHtml;
    mainContent.prepend(errorDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      errorDiv.querySelector('.btn-close').click();
    }, 5000);
  }
}

// Function to show success message
function showSuccess(message, container = null) {
  const successHtml = `
    <div class="alert alert-success alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  if (container) {
    container.innerHTML = successHtml;
  } else {
    const mainContent = document.querySelector('.main-content') || document.body;
    const successDiv = document.createElement('div');
    successDiv.className = 'success-container';
    successDiv.innerHTML = successHtml;
    mainContent.prepend(successDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      successDiv.querySelector('.btn-close').click();
    }, 5000);
  }
}

// Function to animate elements when scrolled into view
function animateOnScroll() {
  // Add animation class to elements
  const animatedElements = document.querySelectorAll('.card, .log-item, .message, .session-item');
  
  // Create intersection observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add animation class based on element type
        if (entry.target.classList.contains('card')) {
          entry.target.style.animation = 'fadeInUp 0.5s ease forwards';
        } else if (entry.target.classList.contains('log-item')) {
          entry.target.style.animation = 'fadeInRight 0.5s ease forwards';
        } else if (entry.target.classList.contains('session-item')) {
          entry.target.style.animation = 'fadeInLeft 0.3s ease forwards';
        }
        
        // Unobserve after animation
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  // Observe all animated elements
  animatedElements.forEach(element => {
    observer.observe(element);
  });
}

// Function to initialize and animate background particles
function initParticles() {
  const bgAnimated = document.querySelector('.bg-animated');
  if (!bgAnimated) return;
  
  // Create additional random particles
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random positions
    const randomTop = Math.random() * 100;
    const randomLeft = Math.random() * 100;
    
    particle.style.top = `${randomTop}%`;
    particle.style.left = `${randomLeft}%`;
    
    // Random sizes
    const randomSize = 2 + Math.random() * 6;
    particle.style.width = `${randomSize}px`;
    particle.style.height = `${randomSize}px`;
    
    // Random animation delay
    const randomDelay = Math.random() * 5;
    particle.style.animationDelay = `${randomDelay}s`;
    
    // Random opacity
    const randomOpacity = 0.05 + Math.random() * 0.15;
    
    // Random color
    const colors = [
      `rgba(93, 98, 255, ${randomOpacity})`,
      `rgba(23, 162, 184, ${randomOpacity})`,
      `rgba(255, 255, 255, ${randomOpacity * 0.7})`
    ];
    
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    bgAnimated.appendChild(particle);
  }
}

// Define keyframe animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeInRight {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes fadeInLeft {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideInDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideOutUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
  
  @keyframes slideInLeft {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  
  @keyframes slideOutLeft {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-100%);
    }
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
`;

// Add animation styles to head
document.head.appendChild(animationStyles);
// Performance monitoring
const PerformanceMetrics = {
  measurements: {},
  
  startMeasurement(label) {
    this.measurements[label] = performance.now();
  },
  
  endMeasurement(label) {
    if (this.measurements[label]) {
      const duration = performance.now() - this.measurements[label];
      delete this.measurements[label];
      this.logMetric(label, duration);
      return duration;
    }
    return null;
  },
  
  logMetric(label, duration) {
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    
    // Send metrics to backend
    fetch('/api/metrics/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, duration })
    }).catch(console.error);
  }
};

// System resource monitoring
function monitorSystemResources() {
  if ('memory' in performance) {
    const memory = performance.memory;
    console.log(`[Resources] Memory Used: ${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB`);
  }
  
  // Monitor response times
  const responseTimeStart = performance.now();
  fetch('/api/health').then(() => {
    const responseTime = performance.now() - responseTimeStart;
    console.log(`[Health] API Response Time: ${responseTime.toFixed(2)}ms`);
  }).catch(console.error);
}

// Start periodic monitoring
setInterval(monitorSystemResources, 60000);

// Global loading state handler
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.add('loading');
    element.innerHTML = `<div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>`;
  }
}

function hideLoading(elementId, content) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove('loading');
    element.innerHTML = content;
  }
}

// Add performance metrics
function logPerformanceMetric(action, duration) {
  console.log(`[Groq Performance] ${action}: ${duration}ms`);
  // Could send to analytics service
}
