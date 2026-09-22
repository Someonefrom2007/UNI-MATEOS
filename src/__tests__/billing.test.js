// BillingService contract — provider-independent, injectable, honest. The UI
// never talks to a payment provider directly; it speaks to this facade.
import { describe, it, expect } from "vitest";
import BillingService from "@/lib/billing/BillingService";
import { LemonSqueezyBillingProvider, getBillingService } from "@/lib/billing/lemonSqueezy";
import { canUpgrade } from "@/lib/billing/useSubscription";
import { PLAN_TIERS, PLAN_FEATURES, planTier } from "@/lib/plans";

const fakeProvider = (overrides = {}) => ({
  name: "fake",
  configured: overrides.configured ?? true,
  startCheckout: async (tier) => ({ checkoutUrl: `https://checkout.test/${tier}` }),
  manage: async () => ({ portalUrl: "https://portal.test" }),
  status: async () => ({
    configured: overrides.configured ?? true,
    subscription: { id: "sub_1", tier: "pro", status: "active" },
    plan: "pro",
  }),
});

describe("BillingService facade", () => {
  it("exposes ready/configured and delegates to the provider", async () => {
    const svc = new BillingService(fakeProvider());
    expect(svc.ready).toBe(true);
    expect(svc.configured).toBe(true);

    const checkout = await svc.startCheckout("pro");
    expect(checkout.checkoutUrl).toMatch(/checkout\.test/);

    const status = await svc.status();
    expect(status.plan).toBe("pro");
    expect(status.subscription.id).toBe("sub_1");

    const mgmt = await svc.manage();
    expect(mgmt.portalUrl).toMatch(/portal\.test/);
  });

  it("reports an honest unconfigured state when no provider is attached", async () => {
    const svc = new BillingService(null);
    expect(svc.ready).toBe(false);
    expect(svc.configured).toBe(false);
    await expect(svc.startCheckout("pro")).rejects.toThrow("No billing provider configured");
    const status = await svc.status();
    expect(status).toEqual({ configured: false, subscription: null, plan: "free" });
    expect((await svc.manage()).portalUrl).toBeNull();
  });

  it("has a stable provider-independent singleton", () => {
    const a = getBillingService();
    const b = getBillingService();
    expect(a).toBeInstanceOf(BillingService);
    expect(b).toBe(a);
    expect(a.provider.name).toBe("lemon-squeezy");
    expect(LemonSqueezyBillingProvider).toBe(a.provider);
  });

  it("refuses to open a checkout for the free tier", async () => {
    const svc = new BillingService({
      configured: true,
      startCheckout: async (tier) => {
        throw new Error("Free has no checkout — it's already yours.");
      },
      manage: async () => ({ portalUrl: null }),
      status: async () => ({ configured: true, subscription: null, plan: "free" }),
    });
    await expect(svc.startCheckout("free")).rejects.toThrow(/already yours/);
  });
});

describe("billing ↔ entitlement bridge", () => {
  it("only exposes the three canonical public tiers", () => {
    expect(PLAN_TIERS.map((t) => t.value)).toEqual(["free", "pro", "ultimate"]);
    expect(PLAN_TIERS.map((t) => t.label)).toEqual(["Free", "Pro", "Ultimate"]);
  });

  it("uses canonical tier values in feature gates", () => {
    expect(PLAN_FEATURES.study_groups).toBe("ultimate");
    expect(PLAN_FEATURES.ai_assistant).toBe("pro");
  });

  it("maps a legacy 'ultra' entitlement profile to 'ultimate'", () => {
    expect(planTier("ultra").value).toBe("ultimate");
  });

  it("canUpgrade is only true on a configured hosted deployment", () => {
    expect(canUpgrade({ mode: "hosted", configured: true })).toBe(true);
    expect(canUpgrade({ mode: "hosted", configured: false })).toBe(false);
    expect(canUpgrade({ mode: "local", configured: false })).toBe(false);
  });
});