"use client";

import { useRef } from "react";

/**
 * Keys for the `Idempotency-Key` header. A key is made the first time an action
 * asks for one and handed out again on every retry of that action, so a
 * double-click or a network retry reaches the server with the same key. Call
 * `done(scope)` after the action succeeds so the next one gets a fresh key.
 *
 * Use one scope per thing being acted on, for example `${submissionId}:approve`,
 * so two different actions never share a key.
 */
export function useIdempotencyKeys() {
  const keys = useRef(new Map<string, string>());

  function keyFor(scope = "default"): string {
    let key = keys.current.get(scope);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(scope, key);
    }
    return key;
  }

  /** The axios config that carries the key for `scope`. */
  function config(scope = "default") {
    return { headers: { "Idempotency-Key": keyFor(scope) } };
  }

  function done(scope = "default"): void {
    keys.current.delete(scope);
  }

  return { keyFor, config, done };
}
