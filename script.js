// Configuration
const API_URL =
'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Get API key from localStorage
function getAPIKey() {
    return localStorage.getItem('geminiAPIKey') || '';
}

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

const SYSTEM_INSTRUCTION = `You are a data structure and algorithm Instructor.
You will only reply to the questions related to data structure and algorithm.
If the question is not related to data structure and algorithm, you will say
'I'm sorry, I can only answer questions related to data structure and algorithm.'
You will also provide the code for the question if the question is related to
data structure and algorithm.
You will also provide the time and space complexity of the code in javascript.
You will also provide the explanation of the code in javascript.
You will also provide the example of the code in javascript.`;

// State
let questionHistory = [];
let statistics = {
    totalQuestions: 0,
    successfulQuestions: 0,
    failedQuestions: 0,
    responseTimes: []
};

// Load history from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromStorage();
    loadStatisticsFromStorage();
    renderHistory();
    updateStatistics();
    checkAPIKey();
});

// Check if API key is set
function checkAPIKey() {
    const apiKey = getAPIKey();
    if (!apiKey) {
        setTimeout(() => {
            alert('Welcome! Please configure your Gemini API key in Settings to get started.');
            openSettings();
        }, 500);
    }
}

// Set question from example buttons
function setQuestion(question) {
    document.getElementById('questionInput').value = question;
    document.getElementById('questionInput').focus();
}

// Main function to ask question
async function askQuestion() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();

    if (!question) {
        alert('Please enter a question!');
        return;
    }

    // Check if API key is set
    const apiKey = getAPIKey();
    if (!apiKey) {
        alert('Please set your API key in Settings first!');
        openSettings();
        return;
    }

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
        alert(`Please wait ${waitTime} seconds before sending another question.`);
        return;
    }

    // Disable input and show loader
    toggleLoading(true);

    // Add user message to chat
    addMessageToChat('user', question);

    // Clear input
    input.value = '';

    try {
        // Update last request time
        const startTime = Date.now();
        lastRequestTime = startTime;

        // Call API
        const response = await callGeminiAPI(question);

        // Calculate response time
        const responseTime = (Date.now() - startTime) / 1000;

        // Add AI response to chat
        addMessageToChat('ai', response);

        // Add to history
        addToHistory(question, response, true, responseTime);

        // Update statistics
        statistics.totalQuestions++;
        statistics.successfulQuestions++;
        statistics.responseTimes.push(responseTime);
        updateStatistics();

        // Save to localStorage
        saveHistoryToStorage();
        saveStatisticsToStorage();

    } catch (error) {
        console.error('Error:', error);
        
        // Better error messages
        let errorMessage = '❌ Sorry, there was an error: ';
        
        if (error.message.includes('429') || error.message.includes('quota')) {
            errorMessage += 'Too many requests. Please wait a few minutes and try again. ' +
                          'Free tier has limited requests per minute.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage += 'Invalid API key. Please check your API key.';
        } else if (error.message.includes('404')) {
            errorMessage += 'Model not found. The API might be having issues.';
        } else {
            errorMessage += error.message || 'Please try again later.';
        }
        
        addMessageToChat('ai', errorMessage);
        
        // Add failed request to history
        addToHistory(question, errorMessage, false, 0);
        
        // Update statistics
        statistics.totalQuestions++;
        statistics.failedQuestions++;
        updateStatistics();
        saveHistoryToStorage();
        saveStatisticsToStorage();
    } finally {
        // Re-enable input
        toggleLoading(false);
    }
}

// Call Gemini API
async function callGeminiAPI(question) {
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: SYSTEM_INSTRUCTION + '\n\nQuestion: ' + question
                    }
                ]
            }
        ]
    };

    const response = await fetch(`${API_URL}?key=${getAPIKey()}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`${response.status}: ${errorMessage}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`${data.error.code || 'API Error'}: ${data.error.message}`);
    }

    if (data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Invalid API response format');
    }
}

// Add message to chat
function addMessageToChat(type, content) {
    const chatContainer = document.getElementById('chatContainer');

    // Remove welcome message if exists
    const welcomeMessage = chatContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    const icon = type === 'user' ? '👤' : '🤖';
    const label = type === 'user' ? 'You' : 'DSA Assistant';

    // Format content with code blocks
    const formattedContent = formatContent(content);

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="icon">${icon}</span>
            <span>${label}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;

    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Format content with code blocks
function formatContent(content) {
    // Convert markdown-style code blocks to HTML
    let formatted = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Toggle loading state
function toggleLoading(isLoading) {
    const sendBtn = document.getElementById('sendBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const input = document.getElementById('questionInput');

    if (isLoading) {
        sendBtn.disabled = true;
        input.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        sendBtn.disabled = false;
        input.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Add to history
function addToHistory(question, answer, success = true, responseTime = 0) {
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        question: question,
        answer: answer,
        success: success,
        responseTime: responseTime
    };

    questionHistory.unshift(historyItem);
    renderHistory();
}

// Update statistics display
function updateStatistics() {
    // Main header stats
    document.getElementById('totalQuestions').textContent = statistics.totalQuestions;
    
    const successRate = statistics.totalQuestions > 0
        ? Math.round((statistics.successfulQuestions / statistics.totalQuestions) * 100)
        : 100;
    document.getElementById('successRate').textContent = successRate + '%';
    
    const avgTime = statistics.responseTimes.length > 0
        ? (statistics.responseTimes.reduce((a, b) => a + b, 0) /
        statistics.responseTimes.length).toFixed(1)
        : '0';
    document.getElementById('avgTime').textContent = avgTime + 's';
    
    // Sidebar stats
    document.getElementById('sidebarTotal').textContent = statistics.totalQuestions;
    document.getElementById('sidebarSuccess').textContent = statistics.successfulQuestions;
    document.getElementById('sidebarFailed').textContent = statistics.failedQuestions;
}

// Render history
function renderHistory() {
    const historyContainer = document.getElementById('historyContainer');

    if (questionHistory.length === 0) {
        historyContainer.innerHTML = '<p class="empty-history">No questions asked yet</p>';
        return;
    }

    historyContainer.innerHTML = questionHistory.map(item => `
        <div class="history-item ${item.success ? 'success' : 'error'}"
        onclick="showHistoryItem(${item.id})">
            <div class="item-header">
                <div class="timestamp">${item.timestamp}</div>
                <div class="status-badge ${item.success ? 'success' : 'error'}">
                    ${item.success ? '✓' : '✗'}
                </div>
            </div>
            <div class="question-text">${escapeHtml(item.question)}</div>
        </div>
    `).join('');
}

// Filter history
function filterHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const historyItems = document.querySelectorAll('.history-item');
    
    historyItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Show history item in chat
function showHistoryItem(id) {
    const item = questionHistory.find(h => h.id === id);
    if (item) {
        // Clear chat
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';

        // Show question and answer
        addMessageToChat('user', item.question);
        addMessageToChat('ai', item.answer);
    }
}

// Clear history
function clearHistory() {
    if (confirm('Are you sure you want to clear all history and statistics?')) {
        questionHistory = [];
        statistics = {
            totalQuestions: 0,
            successfulQuestions: 0,
            failedQuestions: 0,
            responseTimes: []
        };
        localStorage.removeItem('dsaQuestionHistory');
        localStorage.removeItem('dsaStatistics');
        renderHistory();
        updateStatistics();

        // Reset chat
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome! 👋</h2>
                <p>Ask me anything about Data Structures and Algorithms</p>
                <div class="example-questions">
                    <p><strong>Try asking:</strong></p>
                    <button class="example-btn"
                    onclick="setQuestion('What is backtracking algorithm?')">
                    What is backtracking?</button>
                    <button class="example-btn"
                    onclick="setQuestion('Explain binary search with code')">
                    Binary search with code</button>
                    <button class="example-btn"
                    onclick="setQuestion('What is time complexity?')">
                    Time complexity</button>
                </div>
            </div>
        `;
    }
}

// Save history to localStorage
function saveHistoryToStorage() {
    localStorage.setItem('dsaQuestionHistory', JSON.stringify(questionHistory));
}

// Load history from localStorage
function loadHistoryFromStorage() {
    const stored = localStorage.getItem('dsaQuestionHistory');
    if (stored) {
        questionHistory = JSON.parse(stored);
    }
}

// Save statistics to localStorage
function saveStatisticsToStorage() {
    localStorage.setItem('dsaStatistics', JSON.stringify(statistics));
}

// Load statistics from localStorage
function loadStatisticsFromStorage() {
    const stored = localStorage.getItem('dsaStatistics');
    if (stored) {
        statistics = JSON.parse(stored);
    }
}

// Settings Modal Functions
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('apiKeyInput');
    input.value = getAPIKey();
    modal.classList.add('show');
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
}

function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    
    if (!apiKey) {
        alert('Please enter a valid API key!');
        return;
    }
    
    localStorage.setItem('geminiAPIKey', apiKey);
    alert('Settings saved successfully!');
    closeSettings();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('settingsModal');
    if (event.target === modal) {
        closeSettings();
    }
};

// Allow Enter key to send (Shift+Enter for new line)
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('questionInput');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askQuestion();
        }
    });
});
