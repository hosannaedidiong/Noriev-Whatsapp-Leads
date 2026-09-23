// Local dev entrypoint only — Vercel uses api/index.js against the same app.
import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Noriev WhatsApp lead bot listening on :${PORT}`);
});
