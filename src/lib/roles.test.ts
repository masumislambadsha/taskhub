import { describe, expect, it } from "vitest";
import {
  canManage,
  isAdminRole,
  isDemoAdmin,
  refuseDemoAdmin,
  requireAdmin,
  roleLabel,
} from "@/lib/roles";

const as = (role?: string) => ({ user: { id: "u1", role } });

describe("isAdminRole / canManage / isDemoAdmin", () => {
  it("treats admin and demo_admin as admin roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("demo_admin")).toBe(true);
    for (const r of ["worker", "buyer", "", undefined, null, "Admin", "superadmin"]) {
      expect(isAdminRole(r)).toBe(false);
    }
  });

  it("lets only admin manage", () => {
    expect(canManage("admin")).toBe(true);
    for (const r of ["demo_admin", "worker", "buyer", undefined, null]) {
      expect(canManage(r)).toBe(false);
    }
  });

  it("recognises the demo admin", () => {
    expect(isDemoAdmin("demo_admin")).toBe(true);
    expect(isDemoAdmin("admin")).toBe(false);
  });

  it("labels roles for display", () => {
    expect(roleLabel("demo_admin")).toBe("Demo Admin");
    expect(roleLabel("worker")).toBe("Worker");
    expect(roleLabel(undefined)).toBe("");
  });
});

describe("requireAdmin", () => {
  it("lets both admin roles read", () => {
    for (const role of ["admin", "demo_admin"] as const) {
      const g = requireAdmin(as(role), "read");
      expect(g.ok).toBe(true);
      if (g.ok) {
        expect(g.role).toBe(role);
        expect(g.userId).toBe("u1");
        expect(g.viewer).toEqual({ id: "u1", role });
      }
    }
  });

  it("lets only admin write", () => {
    expect(requireAdmin(as("admin"), "write").ok).toBe(true);
  });

  it("refuses a demo admin on write with 403", async () => {
    const g = requireAdmin(as("demo_admin"), "write");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
      expect(await g.response.json()).toEqual({ error: "Demo admin is read-only" });
    }
  });

  it("refuses everyone else with 401, on read and on write", async () => {
    for (const access of ["read", "write"] as const) {
      for (const s of [null, undefined, {}, { user: null }, as("worker"), as("buyer"), as(undefined)]) {
        const g = requireAdmin(s as never, access);
        expect(g.ok).toBe(false);
        if (!g.ok) {
          expect(g.response.status).toBe(401);
          expect(await g.response.json()).toEqual({ error: "Unauthorized" });
        }
      }
    }
  });
});

describe("refuseDemoAdmin", () => {
  it("returns 403 for a demo admin and null for anyone else", async () => {
    const res = refuseDemoAdmin(as("demo_admin"));
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "Demo admin is read-only" });
    expect(refuseDemoAdmin(as("admin"))).toBeNull();
    expect(refuseDemoAdmin(as("worker"))).toBeNull();
    expect(refuseDemoAdmin(null)).toBeNull();
  });
});
