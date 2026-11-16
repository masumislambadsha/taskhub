const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseConversationId,
  isParticipant,
  otherParticipant,
  isLegitimateConversation,
} = require("../lib/conversations");

const TASK = "65f0000000000000000000aa";
const A = "65f0000000000000000000a1";
const B = "65f0000000000000000000b2";
const C = "65f0000000000000000000c3";
const ID = `${TASK}_${A}_${B}`;

test("parseConversationId parses a valid ID", () => {
  assert.deepEqual(parseConversationId(ID), { taskId: TASK, participants: [A, B] });
});

test("parseConversationId rejects bad formats", () => {
  for (const bad of [
    undefined,
    null,
    42,
    {},
    "",
    "abc",
    `${TASK}_${A}`,
    `${TASK}_${A}_${B}_${C}`,
    `${TASK}_${A}_${B}_`,
    ` ${ID}`,
    `${ID}\n`,
    `${TASK}-${A}-${B}`,
    `${TASK}_${A}_${B.slice(1)}`,
    `${TASK}_${A}_${B}0`,
    `${TASK}_${A}_zzzzzzzzzzzzzzzzzzzzzzzz`,
  ]) {
    assert.equal(parseConversationId(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("isParticipant is true only for the two users in the ID", () => {
  assert.equal(isParticipant(ID, A), true);
  assert.equal(isParticipant(ID, B), true);
  assert.equal(isParticipant(ID, C), false);
  assert.equal(isParticipant(ID, TASK), false);
  assert.equal(isParticipant(ID, undefined), false);
  assert.equal(isParticipant(ID, ""), false);
  assert.equal(isParticipant("not-an-id", A), false);
});

test("isParticipant ignores hex case", () => {
  assert.equal(isParticipant(ID, A.toUpperCase()), true);
});

test("otherParticipant returns the counterpart or null", () => {
  assert.equal(otherParticipant(ID, A), B);
  assert.equal(otherParticipant(ID, B), A);
  assert.equal(otherParticipant(ID, C), null);
});

function fakeDb(task) {
  return {
    collection(name) {
      assert.equal(name, "tasks");
      return { findOne: async () => task };
    },
  };
}

test("isLegitimateConversation needs an existing task whose buyer is a participant", async () => {
  assert.equal(await isLegitimateConversation(fakeDb({ buyerId: A }), ID), true);
  assert.equal(await isLegitimateConversation(fakeDb({ buyerId: B }), ID), true);
  assert.equal(await isLegitimateConversation(fakeDb({ buyerId: C }), ID), false);
  assert.equal(await isLegitimateConversation(fakeDb(null), ID), false);
  assert.equal(await isLegitimateConversation(null, ID), false);
  assert.equal(await isLegitimateConversation(fakeDb({ buyerId: A }), "bad"), false);
});
