# 🤖 Intelligent AI Log Parser

An advanced CLI tool that uses Groq AI (Llama 3.3) to provide **exact**, beginner-friendly explanations and fix suggestions for error logs, crashed applications, and code diagnostics.

## 🚀 Features

- **Multi-File Support**: Analyze `.log`, `.logs`, `.txt`, `.js`, `.py`, `.html`, `.css`, and more.
- **Bulk Log Parsing**: Automatically identifies the first 5 lines (exact state) and subsequent unique error patterns in large log files.
- **Mental Analysis (Static & Execution)**: 
  - **Static**: Scans code without running it to find syntax or logical flaws.
  - **Execution**: Runs the file (Node.js/Python) and explains the exact reason for a crash if it happens.
- **Smart Usage Limiter**: 100 entries per 15 minutes to stay within API limits with automatic reset.
- **Memory/Training**: Learns from previous errors via `knowledge.json` to provide instant answers without API calls.
- **Silent & Neutral UI**: Professional dot-based output for clean terminal usage.

---

## 🛠️ Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- A Groq API Key (Get it from [Groq Console](https://console.groq.com/))

### 2. Setup
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/intelligent-log-parser.git
cd intelligent-log-parser
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and add your API key:
```env
GROQ_API_KEY=your_groq_api_key_here
```

---

## 💻 Usage

### 📊 Analyzing Log Files (Apache, Syslog, etc.)
The parser will analyze the first 5 lines for context and then explain any unique errors found:
```bash
node index.js app.logs
```

### 🐍 Debugging Code (JavaScript/Python)
Run your code through the parser. If it crashes, the AI will tell you why and how to fix it:
```bash
node index.js test.js
node index.js script.py
```

### 🌐 Static Analysis (HTML/CSS)
Checks for structural or syntax issues without running:
```bash
node index.js test.html
```

---

## 📂 Project Structure

- `index.js`: Main CLI entry point and analysis logic.
- `aiHelper.js`: AI integration and Knowledge Base (KB) management.
- `usageLimiter.js`: Token/Usage management logic.
- `knowledge.json`: Local training data to minimize API costs.
- `usage.json`: Internal tracking for the 15-minute reset logic.

---

## 📝 Rules for AI Output
The AI is tuned for high-precision mentorship:
1. **Explanation**: Exact and concise (under 20 words).
2. **Metadata**: Provides Error Name, Severity, and exact Location (Line/Col).
3. **Suggestion**: One-line immediate fix.

---

