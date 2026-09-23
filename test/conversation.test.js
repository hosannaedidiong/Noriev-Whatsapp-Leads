import test from "node:test";
import assert from "node:assert/strict";
import { newSession, step, STATES } from "../src/conversation.js";

function send(session, msg) {
  return step(session, { from: "234800000000", text: msg.text || "", buttonId: msg.buttonId || null });
}

test("greets and asks intent on first contact", () => {
  const { session, messages } = send(newSession(), { text: "hi" });
  assert.equal(session.state, STATES.ASK_INTENT);
  assert.equal(messages.length, 1);
  assert.match(messages[0].body, /buy, rent/i);
});

test("full happy path collects a complete, correctly-mapped lead", () => {
  let session = newSession();
  let out;

  out = send(session, { text: "hi" });
  session = out.session;

  out = send(session, { buttonId: "buy" });
  session = out.session;
  assert.equal(session.lead.intent, "buy");
  assert.equal(session.state, STATES.ASK_PROPERTY_TYPE);

  out = send(session, { buttonId: "house" });
  session = out.session;
  assert.equal(session.lead.propertyType, "house");
  assert.equal(session.state, STATES.ASK_LOCATION);

  out = send(session, { text: "Lekki" });
  session = out.session;
  assert.equal(session.lead.location, "Lekki");
  assert.equal(session.state, STATES.ASK_BUDGET);

  out = send(session, { text: "N30m - N45m" });
  session = out.session;
  assert.equal(session.lead.budget, "N30m - N45m");
  assert.equal(session.state, STATES.ASK_TIMELINE);

  out = send(session, { buttonId: "asap" });
  session = out.session;
  assert.equal(session.lead.timeline, "asap");
  assert.equal(session.state, STATES.ASK_NAME);

  out = send(session, { text: "Ada" });
  session = out.session;
  assert.equal(session.lead.name, "Ada");
  assert.equal(session.state, STATES.DONE);
  assert.equal(out.leadComplete, true);
  assert.match(out.messages[0].body, /Thanks, Ada/);
});

test("re-prompts on unrecognized button-stage input instead of advancing", () => {
  let session = newSession();
  session = send(session, { text: "hi" }).session;

  const out = send(session, { text: "maybe idk" });
  assert.equal(out.session.state, STATES.ASK_INTENT);
  assert.match(out.messages[0].body, /didn't catch/i);
});

test("matches intent by free-text title, not just button id", () => {
  let session = newSession();
  session = send(session, { text: "hi" }).session;

  const out = send(session, { text: "rent" });
  assert.equal(out.session.lead.intent, "rent");
  assert.equal(out.session.state, STATES.ASK_PROPERTY_TYPE);
});

test("DONE state supports RESTART", () => {
  let session = { state: STATES.DONE, lead: { name: "Ada" } };
  const out = send(session, { text: "RESTART" });
  assert.equal(out.session.state, STATES.ASK_INTENT);
  assert.deepEqual(out.session.lead, {});
});
