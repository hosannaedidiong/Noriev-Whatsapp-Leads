// @vercel/postgres is in maintenance mode (Vercel's Postgres storage is now
// Neon under the hood) but still reads POSTGRES_URL for compatibility. If it
// stops working, switch to @neondatabase/serverless's neon() against the
// same env var.
import { sql } from "@vercel/postgres";

// Serverless functions get a fresh module scope per cold start, so this just
// avoids redundant CREATE TABLE calls within one warm instance, not globally.
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          wa_id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          lead_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          wa_id TEXT NOT NULL,
          name TEXT,
          intent TEXT,
          property_type TEXT,
          location TEXT,
          budget TEXT,
          timeline TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })();
  }
  return schemaReady;
}

export function openStore() {
  return {
    async getSession(waId) {
      await ensureSchema();
      const { rows } = await sql`SELECT state, lead_json FROM sessions WHERE wa_id = ${waId}`;
      if (rows.length === 0) return null;
      return { state: rows[0].state, lead: rows[0].lead_json };
    },

    async saveSession(waId, session) {
      await ensureSchema();
      await sql`
        INSERT INTO sessions (wa_id, state, lead_json, updated_at)
        VALUES (${waId}, ${session.state}, ${JSON.stringify(session.lead)}::jsonb, now())
        ON CONFLICT (wa_id) DO UPDATE SET
          state = EXCLUDED.state,
          lead_json = EXCLUDED.lead_json,
          updated_at = EXCLUDED.updated_at
      `;
    },

    async saveLead(waId, lead) {
      await ensureSchema();
      await sql`
        INSERT INTO leads (wa_id, name, intent, property_type, location, budget, timeline)
        VALUES (${waId}, ${lead.name}, ${lead.intent}, ${lead.propertyType}, ${lead.location}, ${lead.budget}, ${lead.timeline})
      `;
    },

    async listLeads() {
      await ensureSchema();
      const { rows } = await sql`SELECT * FROM leads ORDER BY id DESC`;
      return rows;
    },
  };
}
