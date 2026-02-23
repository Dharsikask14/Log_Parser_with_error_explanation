import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { explainError, trainError, findExplanation } from "./aiHelper.js";

const args = process.argv.slice(2);
if (args.length === 0) {
    process.exit(1);
}

const fileName = args[0];
const ext = path.extname(fileName).toLowerCase();
let command = "";
let sourceCode = "";

try {
    sourceCode = fs.readFileSync(fileName, "utf8");
} catch (e) { }

function extractLocation(text) {
    const patterns = [
        /:(\d+):(\d+)/,
        /at\s+.*\s+\(.*?(\d+):(\d+)\)/,
        /line\s+(\d+).*?column\s+(\d+)/i,
        /Line (\d+), Col (\d+)/i
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
    // Support for Log Files
    if (ext === ".logs" || ext === ".log" || ext === ".txt") {
        // Priority: Take the first 5 lines for an 'exact' initial state analysis
        const lines = sourceCode.split("\n").slice(0, 5);
        const initialContext = lines.join("\n");

        console.log(`\n . ANALYZING FIRST 5 LINES .`);
        await handleAnalysis(`File Structure/Start:\n${initialContext}\n\nFull Content Snippet:\n${sourceCode.substring(0, 500)}`, false, null);

        // Optional: Also check for specific errors later in the file if any unique ones exist
        const errorLines = sourceCode.split("\n").filter(line =>
            line.toLowerCase().includes("[error]") || line.toLowerCase().includes("failed") || line.toLowerCase().includes("exception")
        );
        const uniqueErrors = [...new Set(errorLines.map(l => l.trim().substring(0, 200)))];
        const newErrors = uniqueErrors.filter(err => !initialContext.includes(err)).slice(0, 3);

        for (const err of newErrors) {
            await handleAnalysis(`Subsequent Error Found: ${err}`, false, null);
        }
        return;
    }

    // Support for VS Code Diagnostics JSON
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

    // 1. Static Analysis
    if (sourceCode && ext !== ".txt") {
        const linesWithNumbers = sourceCode.split("\n").map((line, idx) => `${idx + 1}: ${line}`).join("\n");
        const loc = extractLocation(sourceCode);
        await handleAnalysis(`File: ${fileName}\nNumbered Source:\n${linesWithNumbers.substring(0, 1000)}`, true, loc);
    }

    // 2. Execution
    if (ext === ".js") command = "node";
    else if (ext === ".py") command = "python";
    else return;

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
