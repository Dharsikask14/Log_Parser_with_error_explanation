import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { explainError, trainError, findExplanation } from "./aiHelper.js";
import UsageLimiter from "./usageLimiter.js";

const fileName = process.argv[2];

if (!fileName) {
  console.log("  Intelligent Log Parser | Usage: node index.js <file_or_log>");
  process.exit(1);
}


const runners = {
  ".js": "node",
  ".ts": "ts-node",
  ".py": "python",
  ".dart": "dart run",
  ".java": "java",
  ".go": "go run",
  ".yaml": null,
  ".html": null,
};

const ext = path.extname(fileName).toLowerCase();
let command = runners[ext];
let args = [fileName];

let sourceCode = "";
try {
  if (fs.existsSync(fileName)) {
    sourceCode = fs.readFileSync(fileName, "utf8");
  }
} catch (e) { }

function extractLocation(text) {
  // Common patterns like file.js:10:5 or line 10, column 5
  const patterns = [
    /:(\d+):(\d+)/,           // :line:col
    /at\s+.*\s+\(.*?(\d+):(\d+)\)/, // at func (file:line:col)
    /line\s+(\d+).*?column\s+(\d+)/i, // line 10, column 5
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { line: match[1], col: match[2] };
    }
  }
  return null;
}

async function handleAnalysis(context, isStatic = false, location = null) {
  const typeLabel = isStatic ? ". PRELIMINARY ANALYSIS ." : ". EXECUTION ANALYSIS .";
  console.log(`\n ${typeLabel}`);

  const firstLine = context.split("\n")[0].substring(0, 100);
  const existing = findExplanation(firstLine);

  if (existing) {
    console.log(existing);
    return;
  }

  try {
    const explanation = await explainError(context, isStatic, location);
    console.log(explanation);

    if (!isStatic && !explanation.includes("limit reached")) {
      trainError(firstLine, explanation);
    }
  } catch (err) { }
}

async function main() {
  
  if (ext === ".json" && sourceCode.includes("diagnostics")) {
    try {
      const data = JSON.parse(sourceCode);
      const problems = Array.isArray(data) ? data : (data.diagnostics || [data]);
      for (const p of problems) {
        const loc = {
          line: p.startLineNumber || p.line,
          col: p.startColumn || p.column
        };
        await handleAnalysis(`Diagnostic: ${p.message}\n${JSON.stringify(p)}`, true, loc);
      }
    } catch (e) {
      await handleAnalysis(`Raw Diagnostics:\n${sourceCode}`, true);
    }
    return;
  }

  if (sourceCode && ext !== ".txt") {
    const linesWithNumbers = sourceCode.split("\n").map((line, idx) => `${idx + 1}: ${line}`).join("\n");
    const loc = extractLocation(sourceCode);
    await handleAnalysis(`File: ${fileName}\nNumbered Source:\n${linesWithNumbers.substring(0, 1000)}`, true, loc);
  }

  // 2. Execution
  if (!command) {
    if (ext !== ".js") return;
    command = "node";
  }

  const child = spawn(command, args, { shell: true });
  let output = "";
  let errorOutput = "";

  child.stdout.on("data", (data) => output += data.toString());
  child.stderr.on("data", (data) => errorOutput += data.toString());

  child.on("close", async (code) => {
    const log = errorOutput || output;
    if (code !== 0 || errorOutput.length > 0) {
      const errorLines = log.split("\n").filter(line =>
        line.includes("Error:") || line.includes("Exception") || line.includes("ReferenceError") || line.includes("TypeError")
      );

      const uniqueErrors = [...new Set(errorLines.map(l => l.trim().substring(0, 200)))];

      if (uniqueErrors.length > 0) {
        for (const err of uniqueErrors) {
          const loc = extractLocation(log);
          await handleAnalysis(`Error: ${err}\nFull Log:\n${log}\nContext:\n${sourceCode}`, false, loc);
        }
      } else {
        await handleAnalysis(`Exec Log:\n${log}\nContext:\n${sourceCode}`, false, extractLocation(log));
      }
    } else {
      console.log(" . Success .");
    }
  });
}

main();
