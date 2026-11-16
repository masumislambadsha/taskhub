import { describe, expect, it } from "vitest";
import {
  getConversationId,
  isParticipant,
  parseConversationId,
} from "./conversation";

describe("getConversationId", () => {
  it("is the same whichever user is passed first", () => {
    expect(getConversationId("task1", "userA", "userB")).toBe(
      getConversationId("task1", "userB", "userA"),
    );
  });

  it("joins the task ID and the sorted user IDs", () => {
    expect(getConversationId("task1", "userB", "userA")).toBe(
      "task1_userA_userB",
    );
  });

  it("differs per task", () => {
    expect(getConversationId("task1", "userA", "userB")).not.toBe(
      getConversationId("task2", "userA", "userB"),
    );
  });

  it("differs per pair of users", () => {
    expect(getConversationId("task1", "userA", "userB")).not.toBe(
      getConversationId("task1", "userA", "userC"),
    );
  });
});

const TASK = "65f0000000000000000000aa";
const A = "65f0000000000000000000a1";
const B = "65f0000000000000000000b2";
const C = "65f0000000000000000000c3";

describe("parseConversationId", () => {
  it("parses an ID built by getConversationId", () => {
    expect(parseConversationId(getConversationId(TASK, B, A))).toEqual({
      taskId: TASK,
      participants: [A, B],
    });
  });

  it.each([
    ["empty", ""],
    ["too few parts", `${TASK}_${A}`],
    ["too many parts", `${TASK}_${A}_${B}_${C}`],
    ["short ObjectId", `${TASK}_${A}_abc`],
    ["non-hex characters", `${TASK}_${A}_65f000000000000000000zzz`],
    ["trailing junk", `${TASK}_${A}_${B}x`],
    ["leading junk", `x${TASK}_${A}_${B}`],
    ["newline injection", `${TASK}_${A}_${B}\n`],
    ["non-string", 42],
    ["undefined", undefined],
  ])("rejects %s", (_name, id) => {
    expect(parseConversationId(id)).toBeNull();
  });
});

describe("isParticipant", () => {
  const id = getConversationId(TASK, A, B);

  it("is true for both participants", () => {
    expect(isParticipant(id, A)).toBe(true);
    expect(isParticipant(id, B)).toBe(true);
  });

  it("ignores case", () => {
    expect(isParticipant(id, A.toUpperCase())).toBe(true);
  });

  it("is false for another user", () => {
    expect(isParticipant(id, C)).toBe(false);
  });

  it("is false for the task ID", () => {
    expect(isParticipant(id, TASK)).toBe(false);
  });

  it("is false for a malformed ID or a missing user", () => {
    expect(isParticipant("garbage", A)).toBe(false);
    expect(isParticipant(id, "")).toBe(false);
    expect(isParticipant(id, undefined)).toBe(false);
  });
});
