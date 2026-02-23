import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USAGE_FILE = path.join(__dirname, "usage.json");
const LIMIT = 100;
const RESET_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

class UsageLimiter {
    constructor() {
        this.data = this.loadData();
        this.resetIfNeeded();
    }

    loadData() {
        try {
            if (fs.existsSync(USAGE_FILE)) {
                return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
            }
        } catch (e) { }
        return { count: 0, lastReset: Date.now() };
    }

    saveData() {
        try {
            fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) { }
    }

    resetIfNeeded() {
        const now = Date.now();
        if (now - this.data.lastReset > RESET_INTERVAL_MS) {
            this.data.count = 0;
            this.data.lastReset = now;
            this.saveData();
        }
    }

    checkLimit() {
        this.resetIfNeeded();
        return this.data.count < LIMIT;
    }

    incrementUsage() {
        this.data.count++;
        this.saveData();
    }

    getRemaining() {
        return Math.max(0, LIMIT - this.data.count);
    }
}

export default new UsageLimiter();
