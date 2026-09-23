// Thin client for the Meta WhatsApp Cloud API (Graph API "messages" endpoint).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

const GRAPH_VERSION = "v20.0";

function endpoint(phoneNumberId) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

async function post(token, phoneNumberId, payload) {
  const res = await fetch(endpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${detail}`);
  }
  return res.json();
}

export function createWhatsAppClient({ token, phoneNumberId }) {
  return {
    async sendText(to, body) {
      return post(token, phoneNumberId, {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      });
    },

    // WhatsApp interactive "reply buttons" — max 3 per message, title <= 20 chars.
    async sendButtons(to, body, buttons) {
      return post(token, phoneNumberId, {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      });
    },

    async send(to, message) {
      if (message.buttons && message.buttons.length > 0 && message.buttons.length <= 3) {
        return this.sendButtons(to, message.body, message.buttons);
      }
      return this.sendText(to, message.body);
    },
  };
}

// Extracts the sender + text/button-reply from a raw Cloud API webhook payload.
// Returns null for statuses/other event types this bot doesn't act on.
export function parseIncomingMessage(webhookBody) {
  const entry = webhookBody?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const from = message.from;
  if (message.type === "text") {
    return { from, text: message.text.body, buttonId: null };
  }
  if (message.type === "interactive" && message.interactive?.type === "button_reply") {
    return {
      from,
      text: message.interactive.button_reply.title,
      buttonId: message.interactive.button_reply.id,
    };
  }
  if (message.type === "button") {
    return { from, text: message.button.text, buttonId: message.button.payload };
  }
  return { from, text: "", buttonId: null };
}
