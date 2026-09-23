# Noriev WhatsApp Leads

Lead-capture prototype for Noriev Properties: a "Chat on WhatsApp" button on the
website starts a guided conversation (buy/rent/sell → property type → location →
budget → timeline → name), saves the qualified lead, and pings an agent's WhatsApp
number with a summary.

This is a proof of concept, not a production deployment — see [Handing this to the
backend team](#handing-this-to-the-backend-team) below.

## How it works

- `src/conversation.js` — the qualification flow as a pure state machine (state in,
  message out). No network or DB code in here, so it's fully unit-tested without a
  live WhatsApp connection — see `test/conversation.test.js`.
- `src/whatsapp.js` — thin client for the Meta WhatsApp Cloud API (send text/button
  messages, parse incoming webhook payloads).
- `src/store.js` — SQLite (via `better-sqlite3`) for in-progress conversation state
  and completed leads. File lives at `data/leads.db`, gitignored.
- `src/server.js` — Express app: webhook verification (`GET /webhook`), incoming
  message handling (`POST /webhook`), and a `GET /leads` endpoint to see captured
  leads as JSON for demo purposes.
- `public/widget-snippet.html` — the click-to-chat button to embed on the Noriev
  site (a plain `wa.me` link, no JS dependency).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Meta WhatsApp Business app** (if one doesn't already exist for Noriev):
   - [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create App → Business → add the "WhatsApp" product.
   - Under WhatsApp → API Setup you'll get a **temporary access token** and a **Phone Number ID** for the test number Meta provides. For anything beyond a demo, add a real WhatsApp Business number and generate a **permanent token** (System User, in Business Settings).

3. **Copy `.env.example` to `.env`** and fill in:
   - `WHATSAPP_TOKEN` — the access token from step 2.
   - `WHATSAPP_PHONE_NUMBER_ID` — from the same API Setup page.
   - `WHATSAPP_VERIFY_TOKEN` — make up any string; you'll enter the same value in Meta's webhook config in step 5.
   - `AGENT_NOTIFY_WA_ID` — the WhatsApp number (digits only, no `+`) that should get a message when a lead completes. Optional — leave blank to skip.

4. **Run the server**

   ```bash
   npm start
   ```

5. **Expose it and register the webhook** (Meta needs a public HTTPS URL):

   ```bash
   ngrok http 3000
   ```

   In the Meta App dashboard → WhatsApp → Configuration → Webhook: set the callback
   URL to `https://<your-ngrok-domain>/webhook`, the verify token to whatever you put
   in `.env`, and subscribe to the `messages` field.

6. **Test it** — message the WhatsApp test number from your own phone (Meta's API
   Setup page has a "Send message" tester that adds your number to the allowed
   list for test numbers). You should get the greeting and can walk through the
   flow.

## Running the tests

```bash
npm test
```

Covers the conversation state machine end-to-end (happy path, free-text intent
matching, invalid-input re-prompting, restart) without needing real WhatsApp
credentials.

## Embedding the widget

Open `public/widget-snippet.html`, replace `PHONE_NUMBER` with the real WhatsApp
Business number (international format, digits only — e.g. `2348012345678`), and
paste the `<a>` tag into the Noriev site template before `</body>`.

## Handing this to the backend team

Since Noriev's backend team owns production code, treat this repo as a reference
implementation:

- The conversation flow (`src/conversation.js`) is the actual spec — it's small,
  pure, and fully tested, so it can be ported to whatever stack they run.
- `src/whatsapp.js` shows the exact Cloud API calls needed (send text, send
  buttons, parse an incoming webhook).
- Swap `src/store.js` for whatever they use for persistence (their real DB instead
  of SQLite) — it's an isolated module with a 4-method interface
  (`getSession`/`saveSession`/`saveLead`/`listLeads`).
- Before going live: move off the temporary access token to a permanent System
  User token, apply for WhatsApp Business verification to remove the "test
  number" messaging limits, and consider adding a proper admin view instead of
  the raw `GET /leads` JSON endpoint.
