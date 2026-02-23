import fs from "fs";

export function scanLogFile() {
  const logPath = "./logs/app.log";

  if (!fs.existsSync(logPath)) {
    return null;
  }

  const data = fs.readFileSync(logPath, "utf-8");

  if (data.includes("Error") || data.includes("TypeError")) {
    return data;
  }

  return null;
}
