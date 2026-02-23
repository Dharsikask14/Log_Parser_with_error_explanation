import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const knowledgePath = path.join(__dirname, "knowledge.json");

let openaiClient = null;

function getOpenAI() {
  if (openaiClient) return openaiClient;

  // Try to get key from global context/settings (to be set by extension)
  const apiKey = global.groqApiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing. Please set it in VS Code settings.");
  }

  openaiClient = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return openaiClient;
}

// Helper to set API key from extension
export function setGroqKey(key) {
  global.groqApiKey = key;
  openaiClient = null; // Forces re-init with new key
}


function loadKnowledge() {
  if (!fs.existsSync(knowledgePath)) {
    fs.writeFileSync(knowledgePath, "[]");
  }

  return JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
}

function saveKnowledge(data) {
  fs.writeFileSync(knowledgePath, JSON.stringify(data, null, 2));
}

function trainError(errorText, explanation) {
  const knowledge = loadKnowledge();

  const exists = knowledge.some(
    (item) => item.error.toLowerCase() === errorText.toLowerCase()
  );

  if (!exists) {
    knowledge.push({
      error: errorText,
      explanation: explanation,
    });

    saveKnowledge(knowledge);
  }
}

function findExplanation(errorText) {
  const knowledge = loadKnowledge();

  for (let item of knowledge) {
    if (errorText.toLowerCase().includes(item.error.toLowerCase())) {
      return item.explanation;
    }
  }

  return null;
}

import UsageLimiter from "./usageLimiter.js";

async function explainError(context, isStatic = false, location = null) {
  if (!UsageLimiter.checkLimit()) {
    return `- . Status: AI limit reached (100/15min)
- . Hint: Train manually or wait for reset.`;
  }

  try {
    const analysisType = isStatic ? "Preliminary" : "Execution";
    const locContext = location ? `Location: Line ${location.line}, Col ${location.col}` : "Location: Identify the exact Line and Column from the source code below.";

    const prompt = `
      You are a senior mentor. 
      Stage: ${analysisType}
      ${locContext}
      
      Analyze:
      ${context}
      
      RULES:
      1. Exact Explanation < 20 WORDS.
      2. FORMAT:
      - . Error: [Name]
      - . Severity: [High/Medium/Low]
      - . Location: [Line N, Col M]
      - . Explanation: [Exact < 20 words]
      - . Suggestion: [One-line fix]
    `;

    UsageLimiter.incrementUsage();

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    return `- . Error: ${err.message}`;
  }
}

export { explainError, trainError, findExplanation };
