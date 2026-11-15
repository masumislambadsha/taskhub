import { describe, expect, it } from "vitest";
import { getConversationId } from "./conversation";

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
