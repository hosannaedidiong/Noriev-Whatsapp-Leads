// Pure lead-qualification state machine: (session, incoming) -> { session, messages, leadComplete }
// No I/O here — keeps it testable without a live WhatsApp connection.

export const STATES = {
  START: "START",
  ASK_INTENT: "ASK_INTENT",
  ASK_PROPERTY_TYPE: "ASK_PROPERTY_TYPE",
  ASK_LOCATION: "ASK_LOCATION",
  ASK_BUDGET: "ASK_BUDGET",
  ASK_TIMELINE: "ASK_TIMELINE",
  ASK_NAME: "ASK_NAME",
  DONE: "DONE",
};

const INTENT_OPTIONS = [
  { id: "buy", title: "Buy" },
  { id: "rent", title: "Rent" },
  { id: "sell_list", title: "Sell / List mine" },
];

const PROPERTY_TYPE_OPTIONS = [
  { id: "house", title: "House" },
  { id: "apartment", title: "Apartment" },
  { id: "land", title: "Land" },
];

const TIMELINE_OPTIONS = [
  { id: "asap", title: "Immediately" },
  { id: "1_3_months", title: "1-3 months" },
  { id: "browsing", title: "Just browsing" },
];

export function newSession() {
  return { state: STATES.START, lead: {} };
}

function textOf(incoming) {
  return (incoming.text || "").trim();
}

// Matches free text against a small option list (id or title, case-insensitive substring).
function matchOption(incoming, options) {
  if (incoming.buttonId) {
    const byId = options.find((o) => o.id === incoming.buttonId);
    if (byId) return byId;
  }
  const t = textOf(incoming).toLowerCase();
  if (!t) return null;
  return (
    options.find((o) => o.id.toLowerCase() === t || o.title.toLowerCase() === t) ||
    options.find((o) => o.title.toLowerCase().includes(t) || t.includes(o.id.toLowerCase()))
  );
}

function buttonsMessage(body, options) {
  return { body, buttons: options.map((o) => ({ id: o.id, title: o.title })) };
}

// Advances the conversation by exactly one turn.
export function step(session, incoming) {
  const s = { state: session.state, lead: { ...session.lead } };
  const messages = [];

  switch (s.state) {
    case STATES.START: {
      messages.push({
        body:
          "Hi! 👋 Thanks for reaching out to Noriev Properties. " +
          "I can help you find a property or connect you with an agent. " +
          "Are you looking to buy, rent, or sell/list a property?",
        buttons: INTENT_OPTIONS.map((o) => ({ id: o.id, title: o.title })),
      });
      s.state = STATES.ASK_INTENT;
      break;
    }

    case STATES.ASK_INTENT: {
      const match = matchOption(incoming, INTENT_OPTIONS);
      if (!match) {
        messages.push(buttonsMessage("Sorry, I didn't catch that — please choose one:", INTENT_OPTIONS));
        break;
      }
      s.lead.intent = match.id;
      messages.push(buttonsMessage("Got it. What type of property?", PROPERTY_TYPE_OPTIONS));
      s.state = STATES.ASK_PROPERTY_TYPE;
      break;
    }

    case STATES.ASK_PROPERTY_TYPE: {
      const match = matchOption(incoming, PROPERTY_TYPE_OPTIONS);
      if (!match) {
        messages.push(buttonsMessage("Please pick one:", PROPERTY_TYPE_OPTIONS));
        break;
      }
      s.lead.propertyType = match.id;
      messages.push({ body: "Which area or location are you interested in?" });
      s.state = STATES.ASK_LOCATION;
      break;
    }

    case STATES.ASK_LOCATION: {
      const t = textOf(incoming);
      if (!t) {
        messages.push({ body: "Which area or location? (e.g. Lekki, Ajah, Port Harcourt)" });
        break;
      }
      s.lead.location = t;
      messages.push({ body: "What's your budget range? (e.g. ₦20m - ₦35m)" });
      s.state = STATES.ASK_BUDGET;
      break;
    }

    case STATES.ASK_BUDGET: {
      const t = textOf(incoming);
      if (!t) {
        messages.push({ body: "What's your budget range?" });
        break;
      }
      s.lead.budget = t;
      messages.push(buttonsMessage("When are you looking to move on this?", TIMELINE_OPTIONS));
      s.state = STATES.ASK_TIMELINE;
      break;
    }

    case STATES.ASK_TIMELINE: {
      const match = matchOption(incoming, TIMELINE_OPTIONS);
      if (!match) {
        messages.push(buttonsMessage("Please pick one:", TIMELINE_OPTIONS));
        break;
      }
      s.lead.timeline = match.id;
      messages.push({ body: "Last thing — what name should the agent ask for?" });
      s.state = STATES.ASK_NAME;
      break;
    }

    case STATES.ASK_NAME: {
      const t = textOf(incoming);
      if (!t) {
        messages.push({ body: "What name should the agent ask for?" });
        break;
      }
      s.lead.name = t;
      messages.push({
        body:
          `Thanks, ${t}! A Noriev Properties agent will reach out to you shortly about ` +
          `${s.lead.propertyType || "your property"} in ${s.lead.location || "your area of interest"}. ` +
          "Have a great day! 🏡",
      });
      s.state = STATES.DONE;
      break;
    }

    case STATES.DONE: {
      messages.push({
        body: "You're already on our list — an agent will be in touch. Reply RESTART to start a new search.",
      });
      if (textOf(incoming).toLowerCase() === "restart") {
        return step(newSession(), incoming);
      }
      break;
    }

    default: {
      return step(newSession(), incoming);
    }
  }

  return { session: s, messages, leadComplete: s.state === STATES.DONE };
}
