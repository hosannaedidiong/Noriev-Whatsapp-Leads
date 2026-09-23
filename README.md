# Noriev WhatsApp Leads

Lead-capture bot for Noriev Properties: a "Chat on WhatsApp" button on the
website starts a guided conversation (buy/rent/sell → property type → location →
budget → timeline → name), saves the qualified lead, and pings an agent's WhatsApp
number with a summary. Deployed as a Vercel serverless app with Postgres for
storage, so it stays up and answers even when nobody's laptop is running.

This started as a proof of concept — see [Handing this to the backend
team](#handing-this-to-the-backend-team) if Noriev's own team is taking it over.

## How it works

- `src/conversation.js` — the qualification flow as a pure state machine (state in,
  message out). No network or DB code in here, so it's fully unit-tested without a
  live WhatsApp connection — see `test/conversation.test.js`.
- `src/whatsapp.js` — thin client for the Meta WhatsApp Cloud API (send text/button
  messages, parse incoming webhook payloads).
- `src/store.js` — Postgres (via `@vercel/postgres`) for in-progress conversation
  state and completed leads.
- `src/app.js` — the Express app: webhook verification (`GET /webhook`), incoming
  message handling (`POST /webhook`), and a `GET /leads` endpoint to see captured
  leads as JSON for demo purposes.
- `src/server.js` — local dev entrypoint (`app.listen(...)`).
- `api/index.js` + `vercel.json` — the same Express app deployed as a Vercel
  serverless function; every path is rewritten to it.
- `public/widget-snippet.html` — the click-to-chat button to embed on the Noriev
  site (a plain `wa.me` link, no JS dependency).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database** — this project is linked to a Vercel project with a Postgres
   store connected. Pull its connection details into a local `.env.local`:

   ```bash
   vercel env pull .env.local
   ```

   (First time only: `vercel link` if the project isn't linked yet, and make
   sure a Postgres store is connected under the project's Storage tab.)

3. **Create a Meta WhatsApp Business app** (if one doesn't already exist for Noriev):
   - [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create App → Business → add the "WhatsApp" product.
   - Under WhatsApp → API Setup you'll get a **temporary access token** and a **Phone Number ID** for the test number Meta provides. For anything beyond a demo, add a real WhatsApp Business number and generate a **permanent token** (System User, in Business Settings) — a temporary token expires in 24h and the bot will stop answering.

4. **Set the WhatsApp env vars.** Locally, add to `.env.local`; on Vercel, `vercel env add <name> production` (or the dashboard → Project → Settings → Environment Variables):
   - `WHATSAPP_TOKEN` — the access token from step 3.
   - `WHATSAPP_PHONE_NUMBER_ID` — from the same API Setup page.
   - `WHATSAPP_VERIFY_TOKEN` — make up any string; you'll enter the same value in Meta's webhook config in step 6.
   - `AGENT_NOTIFY_WA_ID` — the WhatsApp number (digits only, no `+`) that should get a message when a lead completes. Optional — leave blank to skip.

5. **Deploy**

   ```bash
   vercel deploy --prod
   ```

   This prints the production URL (e.g. `https://noriev-whatsapp-leads.vercel.app`).

6. **Register the webhook with Meta** — App dashboard → WhatsApp →
   Configuration → Webhook: callback URL `https://<your-vercel-domain>/webhook`,
   verify token = whatever you set in step 4, subscribed field = `messages`.

7. **Test it** — message the WhatsApp number from your own phone. You should
   get the greeting and can walk through the flow; completed leads show up at
   `https://<your-vercel-domain>/leads`.

### Local dev (without deploying)

```bash
npm run dev
```

Runs the same app on `localhost:3000` against the same Postgres store (via
`.env.local`). To receive real webhook calls from Meta while developing
locally, tunnel it with `ngrok http 3000` and point Meta's webhook at the
ngrok URL instead of the Vercel one.

## Running the tests

```bash
npm test
```

Covers the conversation state machine end-to-end (happy path, free-text intent
matching, invalid-input re-prompting, restart) without needing real WhatsApp
or database credentials — `src/conversation.js` has no I/O.

## Embedding the widget

Open `public/widget-snippet.html`, replace `PHONE_NUMBER` with the real WhatsApp
Business number (international format, digits only — e.g. `2348012345678`), and
paste the `<a>` tag into the Noriev site template before `</body>`.

## Handing this to the backend team

If Noriev's own backend team is taking this over instead of running it as-is:

- The conversation flow (`src/conversation.js`) is the actual spec — it's small,
  pure, and fully tested, so it can be ported to whatever stack they run.
- `src/whatsapp.js` shows the exact Cloud API calls needed (send text, send
  buttons, parse an incoming webhook).
- Swap `src/store.js` for whatever they use for persistence — it's an isolated
  module with a 4-method interface (`getSession`/`saveSession`/`saveLead`/`listLeads`).
- Before scaling up: apply for WhatsApp Business verification to raise Meta's
  messaging limits, and consider a proper admin view instead of the raw
  `GET /leads` JSON endpoint.
