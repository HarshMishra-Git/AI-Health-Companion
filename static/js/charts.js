// charts.js - Visualize health data and trends

document.addEventListener('DOMContentLoaded', function() {
  // Initialize health charts if they exist on the page
  initHealthSummaryChart();
  
  // Weekly symptom frequency chart
  initSymptomFrequencyChart();
  
  // Severity distribution chart
  initSeverityDistributionChart();
});

// Function to initialize health summary chart
function initHealthSummaryChart() {
  const chartCanvas = document.getElementById('health-summary-chart');
  
  if (chartCanvas && typeof Chart !== 'undefined') {
    // Get symptom data from the page if available
    let symptomData = [];
    let dates = [];
    
    try {
      // Try to get data from the page
      if (window.healthSummaryData) {
        symptomData = window.healthSummaryData.symptoms;
        dates = window.healthSummaryData.dates;
      } else {
        // Use DOM data if JavaScript data isn't available
        const dataContainer = document.getElementById('health-summary-data');
        if (dataContainer) {
          symptomData = JSON.parse(dataContainer.dataset.symptoms || '[]');
          dates = JSON.parse(dataContainer.dataset.dates || '[]');
        }
      }
    } catch (e) {
      console.error('Error parsing health summary data:', e);
    }
    
    // If no data, show "No data" message
    if (symptomData.length === 0 || dates.length === 0) {
      const ctx = chartCanvas.getContext('2d');
      ctx.font = '16px Arial';
      ctx.fillStyle = '#a0a0a0';
      ctx.textAlign = 'center';
      ctx.fillText('No health data available', chartCanvas.width / 2, chartCanvas.height / 2);
      return;
    }
    
    // Create chart
    new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: dates,
        datasets: symptomData.map((item, index) => ({
          label: item.name,
          data: item.values,
          borderColor: getChartColor(index),
          backgroundColor: getChartColor(index, 0.2),
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 4
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Health Patterns Over Time',
            color: '#e0e0e0',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              color: '#e0e0e0',
              boxWidth: 12
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
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0a0a0'
            }
          },
          y: {
            beginAtZero: true,
            max: 10,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0a0a0'
            }
          }
        }
      }
    });
  }
}

// Function to initialize symptom frequency chart
function initSymptomFrequencyChart() {
  const chartCanvas = document.getElementById('symptom-frequency-chart');
  
  if (chartCanvas && typeof Chart !== 'undefined') {
    // Try to get data from the page
    let symptoms = [];
    let frequencies = [];
    
    try {
      // Try to get data from the page
      if (window.symptomFrequencyData) {
        symptoms = window.symptomFrequencyData.symptoms;
        frequencies = window.symptomFrequencyData.frequencies;
      } else {
        // Use DOM data if JavaScript data isn't available
        const dataContainer = document.getElementById('symptom-frequency-data');
        if (dataContainer) {
          symptoms = JSON.parse(dataContainer.dataset.symptoms || '[]');
          frequencies = JSON.parse(dataContainer.dataset.frequencies || '[]');
        }
      }
    } catch (e) {
      console.error('Error parsing symptom frequency data:', e);
    }
    
    // If no data, show "No data" message
    if (symptoms.length === 0 || frequencies.length === 0) {
      const ctx = chartCanvas.getContext('2d');
      ctx.font = '16px Arial';
      ctx.fillStyle = '#a0a0a0';
      ctx.textAlign = 'center';
      ctx.fillText('No symptom data available', chartCanvas.width / 2, chartCanvas.height / 2);
      return;
    }
    
    // Create chart
    new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: symptoms,
        datasets: [{
          label: 'Frequency',
          data: frequencies,
          backgroundColor: symptoms.map((_, index) => getChartColor(index, 0.7)),
          borderColor: symptoms.map((_, index) => getChartColor(index)),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          title: {
            display: true,
            text: 'Most Frequent Symptoms',
            color: '#e0e0e0',
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#1e1e1e',
            titleColor: '#e0e0e0',
            bodyColor: '#e0e0e0',
            borderColor: '#333333',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0a0a0'
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#e0e0e0'
            }
          }
        }
      }
    });
  }
}

// Function to initialize severity distribution chart
function initSeverityDistributionChart() {
  const chartCanvas = document.getElementById('severity-distribution-chart');
  
  if (chartCanvas && typeof Chart !== 'undefined') {
    // Try to get data from the page
    let severityLabels = ['Low (1-3)', 'Medium (4-7)', 'High (8-10)'];
    let severityCounts = [0, 0, 0];
    
    try {
      // Try to get data from the page
      if (window.severityDistributionData) {
        severityCounts = window.severityDistributionData;
      } else {
        // Use DOM data if JavaScript data isn't available
        const dataContainer = document.getElementById('severity-distribution-data');
        if (dataContainer) {
          severityCounts = JSON.parse(dataContainer.dataset.distribution || '[0,0,0]');
        }
      }
    } catch (e) {
      console.error('Error parsing severity distribution data:', e);
    }
    
    // If no data with values, show "No data" message
    if (severityCounts.every(count => count === 0)) {
      const ctx = chartCanvas.getContext('2d');
      ctx.font = '16px Arial';
      ctx.fillStyle = '#a0a0a0';
      ctx.textAlign = 'center';
      ctx.fillText('No severity data available', chartCanvas.width / 2, chartCanvas.height / 2);
      return;
    }
    
    // Colors for severity levels
    const severityColors = [
      'rgba(40, 167, 69, 0.7)',  // Low - green
      'rgba(255, 193, 7, 0.7)',  // Medium - yellow/amber
      'rgba(220, 53, 69, 0.7)'   // High - red
    ];
    
    // Create chart
    new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: severityLabels,
        datasets: [{
          data: severityCounts,
          backgroundColor: severityColors,
          borderColor: severityColors.map(color => color.replace('0.7', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Symptom Severity Distribution',
            color: '#e0e0e0',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              color: '#e0e0e0',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: '#1e1e1e',
            titleColor: '#e0e0e0',
            bodyColor: '#e0e0e0',
            borderColor: '#333333',
            borderWidth: 1
          }
        },
        cutout: '60%'
      }
    });
  }
}

// Function to get chart colors with optional opacity
function getChartColor(index, opacity = 1) {
  const colors = [
    `rgba(77, 82, 247, ${opacity})`,    // primary
    `rgba(23, 162, 184, ${opacity})`,   // info
    `rgba(40, 167, 69, ${opacity})`,    // success
    `rgba(255, 193, 7, ${opacity})`,    // warning
    `rgba(220, 53, 69, ${opacity})`,    // danger
    `rgba(111, 66, 193, ${opacity})`,   // purple
    `rgba(253, 126, 20, ${opacity})`,   // orange
    `rgba(32, 201, 151, ${opacity})`,   // teal
    `rgba(232, 62, 140, ${opacity})`,   // pink
    `rgba(108, 117, 125, ${opacity})`   // secondary
  ];
  
  return colors[index % colors.length];
}

// Function to create a health trends sparkline
function createSparkline(container, data, color = '#4d52f7', height = 30) {
  if (!container || !data || data.length === 0) return;
  
  const canvas = document.createElement('canvas');
  canvas.height = height;
  canvas.width = container.offsetWidth || 100;
  container.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Calculate y range
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  
  // Plot points
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * canvas.width;
    const y = canvas.height - ((data[i] - min) / range) * canvas.height;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();
  
  // Add end dot
  const lastX = canvas.width;
  const lastY = canvas.height - ((data[data.length - 1] - min) / range) * canvas.height;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fill();
}

// Function to format chart dates
function formatChartDate(dateString) {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
