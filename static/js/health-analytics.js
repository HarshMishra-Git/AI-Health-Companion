/**
 * Advanced Health Analytics Dashboard
 * Provides real-time health trend visualizations and AI-powered insights
 */

// Initialize the health analytics dashboard
document.addEventListener('DOMContentLoaded', function() {
    initHealthDashboard();
    initSentimentAnalysis();
    initHealthPredictions();
    initVitalTrends();
    setupHealthJournalCorrelations();
});

// Global chart color scheme
const healthChartColors = {
    primary: 'rgba(77, 82, 247, 0.8)',
    secondary: 'rgba(156, 39, 176, 0.7)',
    danger: 'rgba(220, 53, 69, 0.7)',
    warning: 'rgba(255, 193, 7, 0.7)',
    success: 'rgba(40, 167, 69, 0.7)',
    info: 'rgba(23, 162, 184, 0.7)',
    gradient: function(ctx, chartArea, colorStart, colorEnd) {
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    }
};

// Health dashboard initialization
function initHealthDashboard() {
    // Only initialize if the dashboard element exists
    if (!document.getElementById('health-analytics-dashboard')) return;
    
    // Display loading indicators
    document.querySelectorAll('.chart-container').forEach(container => {
        showLoading(container);
    });
    
    // Fetch health data for analytics
    fetch('/api/health-analytics/data')
        .then(response => response.json())
        .then(data => {
            // If we got data, create the visualizations
            if (data.success) {
                renderHealthOverview(data);
                renderSymptomTimeline(data);
                renderSeverityDistribution(data);
                renderHealthScoreGauge(calculateHealthScore(data));
                renderInteractionFrequency(data.interactions);
            } else {
                // If there was an error, show message
                document.querySelectorAll('.chart-container').forEach(container => {
                    container.innerHTML = `<div class="text-center text-muted">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Could not load health analytics. Please try again later.</p>
                    </div>`;
                });
            }
        })
        .catch(error => {
            console.error('Error fetching health analytics data:', error);
            document.querySelectorAll('.chart-container').forEach(container => {
                container.innerHTML = `<div class="text-center text-muted">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>Error loading health data. Please try again.</p>
                </div>`;
            });
        });
}

// Calculate health score based on user data
function calculateHealthScore(data) {
    // This would be a more complex algorithm in a real implementation
    // Here we're just doing a simple calculation based on log frequency and severity
    
    if (!data.health_logs || data.health_logs.length === 0) return 85; // Default good score
    
    // Start with a base score
    let score = 100;
    
    // Recent symptoms reduce score
    const recentLogs = data.health_logs.filter(log => {
        const logDate = new Date(log.recorded_at);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return logDate >= oneWeekAgo;
    });
    
    // Reduce score based on recent symptoms severity
    recentLogs.forEach(log => {
        score -= log.severity * 1.5;
    });
    
    // Adjust for improvement trends
    const improvementBonus = data.trends && data.trends.improving ? 10 : 0;
    score += improvementBonus;
    
    // Cap the score between 0 and 100
    return Math.max(0, Math.min(100, score));
}

// Render health overview chart
function renderHealthOverview(data) {
    const container = document.getElementById('health-overview-chart');
    if (!container) return;
    
    hideLoading(container);
    
    // Format data for chart
    const dates = [];
    const symptoms = [];
    const severities = [];
    
    data.health_logs.forEach(log => {
        const date = new Date(log.recorded_at);
        dates.push(formatChartDate(date));
        symptoms.push(log.symptom);
        severities.push(log.severity);
    });
    
    // Create the chart
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Symptom Severity',
                data: severities,
                fill: true,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    return healthChartColors.gradient(
                        ctx, 
                        chartArea, 
                        'rgba(77, 82, 247, 0.1)', 
                        'rgba(77, 82, 247, 0.4)'
                    );
                },
                borderColor: healthChartColors.primary,
                tension: 0.4,
                pointBackgroundColor: healthChartColors.primary,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    title: {
                        display: true,
                        text: 'Severity (1-10)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return formatDate(dates[tooltipItems[0].dataIndex]);
                        },
                        label: function(context) {
                            return [
                                `Symptom: ${symptoms[context.dataIndex]}`,
                                `Severity: ${context.raw}/10`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// Initialize sentiment analysis visualization
function initSentimentAnalysis() {
    const container = document.getElementById('sentiment-analysis-chart');
    if (!container) return;
    
    // Fetch sentiment analysis data
    fetch('/api/health-analytics/sentiment')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderSentimentChart(container, data.sentiments);
            } else {
                container.innerHTML = '<p class="text-muted text-center">No sentiment data available yet.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching sentiment data:', error);
            container.innerHTML = '<p class="text-muted text-center">Could not load sentiment analysis.</p>';
        });
}

// Render sentiment analysis chart
function renderSentimentChart(container, sentiments) {
    if (!sentiments || sentiments.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No sentiment data available yet.</p>';
        return;
    }
    
    const dates = sentiments.map(item => formatChartDate(new Date(item.date)));
    const values = sentiments.map(item => item.score);
    
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Emotional Well-being',
                data: values,
                fill: true,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    return healthChartColors.gradient(
                        ctx, 
                        chartArea, 
                        'rgba(156, 39, 176, 0.1)', 
                        'rgba(156, 39, 176, 0.4)'
                    );
                },
                borderColor: healthChartColors.secondary,
                tension: 0.4,
                pointBackgroundColor: healthChartColors.secondary,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: -1,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Sentiment Score'
                    },
                    ticks: {
                        callback: function(value) {
                            if (value === 1) return 'Very Positive';
                            if (value === 0.5) return 'Positive';
                            if (value === 0) return 'Neutral';
                            if (value === -0.5) return 'Negative';
                            if (value === -1) return 'Very Negative';
                            return '';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const score = context.raw;
                            let sentiment;
                            
                            if (score >= 0.6) sentiment = 'Very Positive';
                            else if (score >= 0.2) sentiment = 'Positive';
                            else if (score >= -0.2) sentiment = 'Neutral';
                            else if (score >= -0.6) sentiment = 'Negative';
                            else sentiment = 'Very Negative';
                            
                            return `Emotional state: ${sentiment} (${score.toFixed(2)})`;
                        }
                    }
                }
            }
        }
    });
}

// Initialize health predictions visualization
function initHealthPredictions() {
    const container = document.getElementById('health-predictions-container');
    if (!container) return;
    
    // Fetch health prediction data
    fetch('/api/health-analytics/predictions')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.predictions) {
                renderPredictions(container, data.predictions);
            } else {
                container.innerHTML = '<p class="text-muted text-center">No prediction data available yet.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching health predictions:', error);
            container.innerHTML = '<p class="text-muted text-center">Could not load health predictions.</p>';
        });
}

// Render health predictions 
function renderPredictions(container, predictions) {
    if (!predictions || predictions.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Not enough data for predictions yet.</p>';
        return;
    }
    
    let html = '<div class="predictions-list">';
    
    predictions.forEach(pred => {
        // Generate icon based on trend direction
        let iconClass = 'bi-arrow-right-circle';
        let trendClass = 'text-info';
        
        if (pred.trend === 'improving') {
            iconClass = 'bi-arrow-up-circle-fill';
            trendClass = 'text-success';
        } else if (pred.trend === 'worsening') {
            iconClass = 'bi-arrow-down-circle-fill';
            trendClass = 'text-danger';
        }
        
        html += `
            <div class="prediction-item mb-3">
                <div class="d-flex align-items-center">
                    <div class="icon-container me-3 ${trendClass}">
                        <i class="bi ${iconClass} fs-3"></i>
                    </div>
                    <div class="prediction-content">
                        <h6 class="mb-1">${pred.label}</h6>
                        <p class="mb-0 text-muted small">${pred.description}</p>
                        ${pred.confidence ? `<div class="progress mt-1" style="height: 6px">
                            <div class="progress-bar" 
                                role="progressbar" 
                                style="width: ${pred.confidence * 100}%" 
                                aria-valuenow="${pred.confidence * 100}" 
                                aria-valuemin="0" 
                                aria-valuemax="100">
                            </div>
                        </div>
                        <small class="text-muted">Confidence: ${Math.round(pred.confidence * 100)}%</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Render health score gauge
function renderHealthScoreGauge(score) {
    const container = document.getElementById('health-score-gauge');
    if (!container) return;
    
    // Get the right color based on score
    let color = healthChartColors.danger;
    if (score >= 70) color = healthChartColors.success;
    else if (score >= 40) color = healthChartColors.warning;
    
    // Create canvas element for the gauge
    container.innerHTML = `<canvas height="160"></canvas>
        <div class="score-display text-center mt-2">
            <h2 class="mb-0">${Math.round(score)}</h2>
            <p class="text-muted small">Health Score</p>
        </div>`;
    
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    
    // Create the gauge chart
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [color, 'rgba(200, 200, 200, 0.2)'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        }
    });
}

// Initialize vital signs trends
function initVitalTrends() {
    // This would connect to wearable device data in a real implementation
    // Here we're just displaying a simulated view
    const container = document.getElementById('vital-trends-chart');
    if (!container) return;
    
    // Simulate vital signs data
    const days = 14;
    const dates = Array.from({length: days}, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return formatChartDate(date);
    });
    
    // Simulated heart rate data (realistic values)
    const heartRateBase = 72;
    const heartRateData = dates.map(() => heartRateBase + Math.floor(Math.random() * 10) - 5);
    
    // Create the chart
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Heart Rate (BPM)',
                data: heartRateData,
                borderColor: healthChartColors.danger,
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: healthChartColors.danger,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Heart Rate (BPM)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Setup health correlations
function setupHealthJournalCorrelations() {
    const container = document.getElementById('health-correlations');
    if (!container) return;
    
    // This would be a more sophisticated analysis in a real implementation
    // Here we're just showing UI concepts
    
    container.innerHTML = `
        <div class="correlation-item p-3 mb-3 border-start border-4 border-info rounded-end shadow-sm">
            <h6><i class="bi bi-link me-2"></i> Potential Correlation Detected</h6>
            <p class="mb-1">Your headache symptoms appear to intensify following days with reported stress.</p>
            <small class="text-muted">Based on 7 occurrences</small>
        </div>
        <div class="correlation-item p-3 mb-3 border-start border-4 border-success rounded-end shadow-sm">
            <h6><i class="bi bi-link me-2"></i> Positive Pattern</h6>
            <p class="mb-1">Days with reported exercise show lower overall symptom severity scores.</p>
            <small class="text-muted">Based on 12 observations</small>
        </div>
    `;
}

// Render symptom timeline
function renderSymptomTimeline(data) {
    const container = document.getElementById('symptom-timeline');
    if (!container) return;
    
    // Group symptoms by month
    const symptomsByMonth = {};
    data.health_logs.forEach(log => {
        const date = new Date(log.recorded_at);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        
        if (!symptomsByMonth[monthYear]) {
            symptomsByMonth[monthYear] = {};
        }
        
        if (!symptomsByMonth[monthYear][log.symptom]) {
            symptomsByMonth[monthYear][log.symptom] = 0;
        }
        
        symptomsByMonth[monthYear][log.symptom]++;
    });
    
    // Prepare timeline data
    const months = Object.keys(symptomsByMonth).sort((a, b) => {
        const [aMonth, aYear] = a.split('/').map(Number);
        const [bMonth, bYear] = b.split('/').map(Number);
        return aYear === bYear ? aMonth - bMonth : aYear - bYear;
    });
    
    // Get unique symptoms
    const uniqueSymptoms = new Set();
    Object.values(symptomsByMonth).forEach(monthData => {
        Object.keys(monthData).forEach(symptom => uniqueSymptoms.add(symptom));
    });
    
    const symptoms = Array.from(uniqueSymptoms);
    
    // Prepare datasets
    const datasets = symptoms.map((symptom, index) => {
        // Generate a color from our palette
        const colors = [
            healthChartColors.primary,
            healthChartColors.secondary,
            healthChartColors.danger,
            healthChartColors.warning,
            healthChartColors.success,
            healthChartColors.info
        ];
        
        const color = colors[index % colors.length];
        
        return {
            label: symptom,
            data: months.map(month => symptomsByMonth[month][symptom] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4
        };
    });
    
    // Format month labels for display
    const monthLabels = months.map(month => {
        const [m, y] = month.split('/');
        const date = new Date(y, m - 1, 1);
        return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
    });
    
    // Create the chart
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Occurrences'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return monthLabels[tooltipItems[0].dataIndex];
                        }
                    }
                }
            }
        }
    });
}

// Render severity distribution
function renderSeverityDistribution(data) {
    const container = document.getElementById('severity-distribution-chart');
    if (!container) return;
    
    // Count occurrences of each severity level
    const severityCounts = Array(11).fill(0); // 0-10
    data.health_logs.forEach(log => {
        severityCounts[log.severity]++;
    });
    
    // Remove severity 0 (not used)
    severityCounts.shift();
    
    // Create the chart
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
            datasets: [{
                data: severityCounts,
                backgroundColor: [
                    'rgba(32, 201, 151, 0.7)',
                    'rgba(32, 201, 151, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(220, 53, 69, 0.7)',
                    'rgba(220, 53, 69, 0.7)',
                    'rgba(220, 53, 69, 0.7)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    ticks: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map(function(label, i) {
                                    const value = data.datasets[0].data[i];
                                    let severity;
                                    
                                    // Group severity levels
                                    if (i < 2) severity = 'Mild';
                                    else if (i < 7) severity = 'Moderate'; 
                                    else severity = 'Severe';
                                    
                                    return {
                                        text: `${label} - ${severity} (${value})`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: isNaN(data.datasets[0].data[i]) || chart.getDatasetMeta(0).data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const severity = context.label;
                            const count = context.raw;
                            let severityText;
                            
                            // Interpret severity
                            const severityNum = parseInt(severity);
                            if (severityNum <= 2) severityText = 'Mild';
                            else if (severityNum <= 7) severityText = 'Moderate';
                            else severityText = 'Severe';
                            
                            return `Severity ${severity} (${severityText}): ${count} occurrences`;
                        }
                    }
                }
            }
        }
    });
}

// Render interaction frequency chart
function renderInteractionFrequency(interactions) {
    const container = document.getElementById('interaction-frequency-chart');
    if (!container) return;
    
    // Default data if no interactions provided
    const defaultData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        dataset: [2, 4, 3, 5, 3, 1, 1]
    };
    
    // Use provided data or defaults
    const data = interactions || defaultData;
    
    // Create the chart
    const ctx = container.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Interactions',
                data: data.dataset,
                backgroundColor: healthChartColors.info,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Interactions'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Utility functions
function formatChartDate(date) {
    return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('default', { year: 'numeric', month: 'long', day: 'numeric' });
}