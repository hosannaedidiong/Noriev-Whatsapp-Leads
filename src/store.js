import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export function openStore(dbPath = path.join(DATA_DIR, "leads.db")) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      wa_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      lead_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id TEXT NOT NULL,
      name TEXT,
      intent TEXT,
      property_type TEXT,
      location TEXT,
      budget TEXT,
      timeline TEXT,
      created_at TEXT NOT NULL
    );
  `);

  return {
    getSession(waId) {
      const row = db.prepare("SELECT state, lead_json FROM sessions WHERE wa_id = ?").get(waId);
      if (!row) return null;
      return { state: row.state, lead: JSON.parse(row.lead_json) };
    },

    saveSession(waId, session) {
      db.prepare(
        `INSERT INTO sessions (wa_id, state, lead_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(wa_id) DO UPDATE SET state = excluded.state, lead_json = excluded.lead_json, updated_at = excluded.updated_at`
      ).run(waId, session.state, JSON.stringify(session.lead));
    },

    saveLead(waId, lead) {
      db.prepare(
        `INSERT INTO leads (wa_id, name, intent, property_type, location, budget, timeline, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(waId, lead.name, lead.intent, lead.propertyType, lead.location, lead.budget, lead.timeline);
    },

    listLeads() {
      return db.prepare("SELECT * FROM leads ORDER BY id DESC").all();
    },

    close() {
      db.close();
    },
  };
}
