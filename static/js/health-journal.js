// health-journal.js - Handle health journal functionality

document.addEventListener('DOMContentLoaded', function() {
  // Health journal form
  const healthJournalForm = document.getElementById('health-journal-form');

  // If we're on the health journal page
  if (healthJournalForm) {
    // Set up form submission
    healthJournalForm.addEventListener('submit', function(event) {
      event.preventDefault();

      // Get form data
      const symptom = document.getElementById('symptom').value.trim();
      const severity = document.getElementById('severity').value;
      const description = document.getElementById('description').value.trim();

      // Validate input
      if (!symptom) {
        showError('Please enter a symptom');
        return;
      }

      // Submit the health log
      addHealthLog(symptom, severity, description);
    });

    // Set up delete handlers
    setupDeleteHandlers();

    // Initialize severity slider if it exists
    initSeveritySlider();

    // Initialize health trends chart if it exists
    initHealthTrendsChart();
  }
});

// Function to add a health log
function addHealthLog(symptom, severity, description) {
  // Show loading state
  const submitBtn = document.querySelector('#health-journal-form button[type="submit"]');
  showLoading(submitBtn, 'Saving...');

  // Make API request
  fetch('/api/health-journal/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symptom: symptom,
      severity: severity,
      description: description
    })
  })
  .then(response => response.json())
  .then(data => {
    // Hide loading state
    hideLoading(submitBtn);

    if (data.success) {
      // Add the new log to the UI
      addLogToUI(data.log);

      // Reset form
      document.getElementById('symptom').value = '';
      document.getElementById('severity').value = '5';
      document.getElementById('description').value = '';

      // Update severity indicator
      if (document.getElementById('severity-value')) {
        document.getElementById('severity-value').textContent = '5';
      }

      // Show success message
      showSuccess('Health log added successfully');

      // Update chart if it exists
      updateHealthTrendsChart();
    } else {
      showError(data.error || 'Failed to add health log');
    }
  })
  .catch(error => {
    console.error('Error adding health log:', error);
    hideLoading(submitBtn);
    showError('Failed to add health log. Please try again.');
  });
}

// Function to add a log to the UI
function addLogToUI(log) {
  const logsContainer = document.getElementById('health-logs');
  if (!logsContainer) return;

  // Create severity class
  let severityClass = 'low';
  if (log.severity >= 8) {
    severityClass = 'high';
  } else if (log.severity >= 4) {
    severityClass = 'medium';
  }

  // Create the log item element
  const logItem = document.createElement('div');
  logItem.className = 'log-item';
  logItem.dataset.logId = log.id;

  logItem.innerHTML = `
    <div class="symptom-header">
      <h3 class="symptom-name">${log.symptom}</h3>
      <div class="symptom-severity">
        <span class="severity-badge ${severityClass}">Severity: ${log.severity}/10</span>
      </div>
    </div>
    <div class="symptom-date">${formatDateTime(log.recorded_at)}</div>
    <p class="symptom-description">${log.description || 'No description provided.'}</p>
    <div class="log-actions">
      <button type="button" class="btn btn-sm btn-outline-danger delete-log-btn">
        <i class="bi bi-trash"></i> Delete
      </button>
    </div>
  `;

  // Add delete handler
  const deleteBtn = logItem.querySelector('.delete-log-btn');
  deleteBtn.addEventListener('click', function() {
    confirmDeleteLog(log.id);
  });

  // Add to container at the beginning
  logsContainer.insertBefore(logItem, logsContainer.firstChild);
}

// Function to set up delete handlers
function setupDeleteHandlers() {
  document.querySelectorAll('.delete-log-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const logId = this.closest('.log-item').dataset.logId;
      confirmDeleteLog(logId);
    });
  });
}

// Function to confirm log deletion
function confirmDeleteLog(logId) {
  if (confirm('Are you sure you want to delete this health log? This action cannot be undone.')) {
    deleteHealthLog(logId);
  }
}

// Function to delete a health log
function deleteHealthLog(logId) {
  fetch(`/api/health-journal/delete/${logId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Remove log from UI
      const logItem = document.querySelector(`.log-item[data-log-id="${logId}"]`);
      if (logItem) {
        logItem.remove();
      }

      // Show success message
      showSuccess('Health log deleted successfully');

      // Update chart if it exists
      updateHealthTrendsChart();
    } else {
      showError(data.error || 'Failed to delete health log');
    }
  })
  .catch(error => {
    console.error('Error deleting health log:', error);
    showError('Failed to delete health log. Please try again.');
  });
}

// Function to initialize severity slider
function initSeveritySlider() {
  const severitySlider = document.getElementById('severity');
  const severityValue = document.getElementById('severity-value');

  if (severitySlider && severityValue) {
    // Set initial value
    severityValue.textContent = severitySlider.value;

    // Update on change
    severitySlider.addEventListener('input', function() {
      severityValue.textContent = this.value;

      // Update color based on severity
      if (this.value >= 8) {
        severityValue.className = 'text-danger';
      } else if (this.value >= 4) {
        severityValue.className = 'text-warning';
      } else {
        severityValue.className = 'text-success';
      }
    });
  }
}

// Smart analysis function with clean markdown rendering
async function performSmartAnalysis() {
  fetch('/api/health/smart-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    const analysisDiv = document.getElementById('smart-analysis');
    if (data.success && data.analysis) {
      let fullReport = '';

      // Build markdown report
      if (data.analysis.patterns && data.analysis.patterns.length > 0) {
        fullReport += '## Identified Patterns\n\n';
        data.analysis.patterns.forEach(pattern => {
          fullReport += `- **${pattern.symptom}**: ${pattern.description}\n`;
        });
        fullReport += '\n';
      }

      if (data.analysis.correlations && data.analysis.correlations.length > 0) {
        fullReport += '## Symptom Correlations\n\n';
        data.analysis.correlations.forEach(correlation => {
          fullReport += `- ${correlation}\n`;
        });
        fullReport += '\n';
      }

      if (data.analysis.recommendations && data.analysis.recommendations.length > 0) {
        fullReport += '## Recommendations\n\n';
        data.analysis.recommendations.forEach(rec => {
          fullReport += `- ${rec}\n`;
        });
        fullReport += '\n';
      }

      // Convert markdown → HTML
      const html = marked.parse(fullReport);
      analysisDiv.innerHTML = html || 'No patterns found in the analysis.';
    } else {
      analysisDiv.innerHTML = 'Analysis not available. Please try again.';
    }
  })
  .catch(error => {
    console.error('Error:', error);
    document.getElementById('smart-analysis').innerHTML = 'Error performing analysis.';
  });
}


async function generateHealthReport() {
    try {
        const response = await fetch('/api/health/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            displayHealthReport(data.report);
        } else {
            showError(data.error || 'Failed to generate report');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate health report');
    }
}

function displayHealthReport(report) {
    const container = document.getElementById('health-report');
    if (!container) return;

    const reportHtml = marked.parse(report.report); // Using marked.js for markdown
    container.innerHTML = `
        <div class="card bg-dark-lightest">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0"><i class="bi bi-file-text"></i> Health Report</h5>
                <button class="btn btn-sm btn-outline-primary" onclick="downloadReport()">
                    <i class="bi bi-download"></i> Download
                </button>
            </div>
            <div class="card-body">
                ${reportHtml}
            </div>
        </div>
    `;
}

function downloadReport() {
    const reportContent = document.getElementById('health-report').innerText;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'health_report.txt';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Function to initialize health trends chart
function initHealthTrendsChart() {
  const chartCanvas = document.getElementById('health-trends-chart');

  if (chartCanvas && typeof Chart !== 'undefined') {
    // Get logs data
    const logs = [];
    document.querySelectorAll('.log-item').forEach(item => {
      logs.push({
        id: item.dataset.logId,
        symptom: item.querySelector('.symptom-name').textContent,
        severity: parseInt(item.querySelector('.severity-badge').textContent.match(/\d+/)[0]),
        date: item.querySelector('.symptom-date').textContent
      });
    });

    // Reverse logs to show chronological order
    logs.reverse();

    // Prepare data for chart
    const labels = logs.map(log => {
      const date = new Date(log.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    const datasets = [];

    // Group by symptom
    const symptoms = [...new Set(logs.map(log => log.symptom))];

    // Generate colors for each symptom
    const colors = generateChartColors(symptoms.length);

    // Create datasets
    symptoms.forEach((symptom, index) => {
      const symptomLogs = logs.filter(log => log.symptom === symptom);

      // Create data points with null for missing dates
      const data = [];
      labels.forEach(label => {
        const matchingLog = symptomLogs.find(log => {
          const date = new Date(log.date);
          return `${date.getMonth() + 1}/${date.getDate()}` === label;
        });

        data.push(matchingLog ? matchingLog.severity : null);
      });

      datasets.push({
        label: symptom,
        data: data,
        borderColor: colors[index],
        backgroundColor: colors[index] + '33',
        fill: false,
        tension: 0.3,
        pointRadius: 4
      });
    });

    // Create chart
    window.healthTrendsChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date',
              color: '#e0e0e0'
            },
            grid: {
              color: '#333333'
            },
            ticks: {
              color: '#a0a0a0'
            }
          },
          y: {
            beginAtZero: true,
            max: 10,
            title: {
              display: true,
              text: 'Severity',
              color: '#e0e0e0'
            },
            grid: {
              color: '#333333'
            },
            ticks: {
              color: '#a0a0a0'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Health Trends Over Time',
            color: '#e0e0e0',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              color: '#e0e0e0',
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1e1e1e',
            titleColor: '#e0e0e0',
            bodyColor: '#e0e0e0',
            borderColor: '#333333',
            borderWidth: 1
          }
        }
      }
    });
  }
}

// Function to update health trends chart
function updateHealthTrendsChart() {
  if (window.healthTrendsChart) {
    // Refresh the page to update the chart
    // In a production app, we would update the chart data directly
    window.location.reload();
  }
}

// Function to generate chart colors
function generateChartColors(count) {
  const baseColors = [
    '#4d52f7', // primary
    '#17a2b8', // info
    '#28a745', // success
    '#ffc107', // warning
    '#dc3545', // danger
    '#6f42c1', // purple
    '#fd7e14', // orange
    '#20c997', // teal
    '#e83e8c', // pink
    '#6c757d'  // secondary
  ];

  // If we need more colors than in the base array
  if (count > baseColors.length) {
    // Generate additional colors
    for (let i = baseColors.length; i < count; i++) {
      const hue = (i * 137) % 360; // Use golden ratio for even distribution
      baseColors.push(`hsl(${hue}, 70%, 60%)`);
    }
  }

  return baseColors.slice(0, count);
}