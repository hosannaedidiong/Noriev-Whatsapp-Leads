import "dotenv/config";
import express from "express";
import { newSession, step } from "./conversation.js";
import { openStore } from "./store.js";
import { createWhatsAppClient, parseIncomingMessage } from "./whatsapp.js";

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const AGENT_NOTIFY_WA_ID = process.env.AGENT_NOTIFY_WA_ID;

const store = openStore();
const wa = createWhatsAppClient({
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
});

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Meta calls this once, at setup, to prove you control the endpoint.
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  // Meta expects a fast 200 regardless of downstream outcome, or it will retry the delivery.
  res.sendStatus(200);

  const incoming = parseIncomingMessage(req.body);
  if (!incoming || !incoming.from) return;

  try {
    await handleIncoming(incoming);
  } catch (err) {
    console.error("Failed to handle incoming message:", err);
  }
});

async function handleIncoming(incoming) {
  const existing = store.getSession(incoming.from) || newSession();
  const { session, messages, leadComplete } = step(existing, incoming);

  // Persist state/lead before attempting delivery — a failed WhatsApp send
  // (rate limit, transient network error) must never cost us data we already have.
  store.saveSession(incoming.from, session);

  if (leadComplete) {
    store.saveLead(incoming.from, session.lead);
    console.log("New qualified lead:", { waId: incoming.from, ...session.lead });
  }

  for (const message of messages) {
    try {
      await wa.send(incoming.from, message);
    } catch (err) {
      console.error("Failed to deliver WhatsApp message:", err);
    }
  }

  if (leadComplete && AGENT_NOTIFY_WA_ID) {
    const summary =
      `New lead 🏡\n` +
      `Name: ${session.lead.name}\n` +
      `Intent: ${session.lead.intent}\n` +
      `Type: ${session.lead.propertyType}\n` +
      `Location: ${session.lead.location}\n` +
      `Budget: ${session.lead.budget}\n` +
      `Timeline: ${session.lead.timeline}\n` +
      `WhatsApp: ${incoming.from}`;
    try {
      await wa.sendText(AGENT_NOTIFY_WA_ID, summary);
    } catch (err) {
      console.error("Failed to notify agent:", err);
    }
  }
}

// Demo/admin: view captured leads without opening the sqlite file directly.
app.get("/leads", (_req, res) => res.json(store.listLeads()));

app.listen(PORT, () => {
  console.log(`Noriev WhatsApp lead bot listening on :${PORT}`);
});
