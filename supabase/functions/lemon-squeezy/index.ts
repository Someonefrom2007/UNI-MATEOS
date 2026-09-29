// UNI·MATE Billing Edge Function — Lemon Squeezy provider.
//
// Server-side source of truth for all billing state. The browser only talks to
// this endpoint; it never sees an API key, webhook secret, store id or variant
// id. This process:
//
//   1. AUTHENTICATED ACTIONS (client calls these with the user's JWT):
//      - checkout  { tier }  -> creates a Lemon Squeezy checkout and returns
//                               { configured, checkoutUrl }.
//      - status               -> { configured, subscription, plan }.
//      - manage               -> { portalUrl } (update-payment-method link).
//   2. WEBHOOK (Lemon Squeezy -> this function, signed with X-Signature):
//      - verifies the HMAC-SHA256 signature against LEMON_SQUEEZY_WEBHOOK_SECRET
//      - dedupes every event via the webhook_events table (idempotent)
//      - maps variant -> tier and persists the subscription, then updates the
//        user's entitlement plan in auth user_metadata.
//
//      AUTHORITATIVE SOURCE: `subscriptions.tier` — it is written only here
//      (service role) and has no client INSERT/UPDATE policy, so a user cannot
//      grant themselves a tier. The `user_metadata.plan` mirror below is a
//      DISPLAY convenience only: it is written here for the profile UI, and
//      nothing authorizes on it, because the account owner can rewrite it via
//      auth.updateUser(). The `status` action therefore derives `plan` from
//      the subscription row via effectiveTier() below — the client feeds that
//      value straight into can(), so it has to be server-owned.
//
//      The signature header decrypts... the body hash is verified BEFORE any
//      billing state is touched. Unverified webhooks are rejected outright.
//
// Required env (see .env.example notes / deploy docs):
//   LEMON_SQUEEZY_API_KEY
//   LEMON_SQUEEZY_WEBHOOK_SECRET
//   LEMON_SQUEEZY_STORE_ID
//   LEMON_SQUEEZY_PRO_VARIANT_ID
//   LEMON_SQUEEZY_ULTIMATE_VARIANT_ID
//   LEMON_SQUEEZY_REDIRECT_URL  (optional — where the customer lands after pay)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LS_API = "https://api.lemonsqueezy.com/v1";
const textBody = async (req) => {
  const raw = await req.text();
  return { raw, body: raw ? JSON.parse(raw) : {} };
};

const isConfigured = () =>
  Boolean(
    Deno.env.get("LEMON_SQUEEZY_API_KEY") &&
      Deno.env.get("LEMON_SQUEEZY_STORE_ID") &&
      Deno.env.get("LEMON_SQUEEZY_PRO_VARIANT_ID") &&
      Deno.env.get("LEMON_SQUEEZY_ULTIMATE_VARIANT_ID")
  );

// Map a Lemon Squeezy variant id to the UNI·MATE tier ("pro" | "ultimate"),
// or null when the variant is not one we sell.
const tierForVariant = (variantId) => {
  const v = String(variantId || "");
  if (v && v === String(Deno.env.get("LEMON_SQUEEZY_ULTIMATE_VARIANT_ID"))) return "ultimate";
  if (v && v === String(Deno.env.get("LEMON_SQUEEZY_PRO_VARIANT_ID"))) return "pro";
  return null;
};

// Statuses that keep the user entitled (active, or grace/cancellation until
// the period ends). Only "expired" revokes access — Lemonsqueezy fires it
// when the subscription truly ends.
const KEEPS_ENTITLEMENT = new Set(["on_trial", "active", "paused", "cancelled", "unpaid"]);

// Single definition of "is this subscription row actually entitled right now".
// Mirrors the webhook's own rule (tier present AND status keeps entitlement)
// and adds the guard that rule was missing: a `cancelled` row keeps access
// until `renews_at`, and not one instant longer. Without it a lapsed
// cancellation left the row at tier='pro' indefinitely, because the row is
// only rewritten when a webhook fires.
//
// Exported to the `status` action so the client's can() gate is decided from
// the server-owned row rather than from user_metadata, which the account
// owner can write for themselves via auth.updateUser().
const effectiveTier = (subscription) => {
  if (!subscription) return "free";
  const tier = String(subscription.tier || "free").toLowerCase();
  if (tier === "free") return "free";
  const status = String(subscription.status || "");
  if (!KEEPS_ENTITLEMENT.has(status)) return "free";
  // Only terminating states are expiry-checked. For `active`/`on_trial`,
  // `renews_at` is the next billing date and reading it here would risk
  // revoking a paying customer on a stale value.
  if (status === "cancelled" && subscription.renews_at) {
    const endsAt = new Date(subscription.renews_at).getTime();
    if (Number.isFinite(endsAt) && endsAt <= Date.now()) return "free";
  }
  return tier;
};

const safeUpsert = async (supabase, table, payload, onConflict) => {
  try {
    return await supabase.from(table).upsert(payload, { onConflict });
  } catch (e) {
    console.error(`[billing] table ${table} unavailable:`, e.message);
    return { error: e.message };
  }
};

const setEntitlement = async (supabase, userId, plan) => {
  // Display mirror only — see the header note. `subscriptions.tier` is the
  // authoritative entitlement; this keeps the profile badge in sync but is
  // never used for an authorization decision.
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { plan },
    });
    if (error) console.error(`[billing] entitlement mirror update failed:`, error.message);
    return !error;
  } catch (e) {
    console.error(`[billing] entitlement mirror update failed:`, e.message);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Webhook plumbing
// ---------------------------------------------------------------------------

const verifySignature = async (secret, rawBody, signature) => {
  if (!secret || !rawBody || !signature) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const received = String(signature).toLowerCase();
    return expected === received;
  } catch (e) {
    console.error("[billing] signature verify failed:", e.message);
    return false;
  }
};

const handleWebhook = async (supabase, payload, rawBody) => {
  const meta = payload?.meta || {};
  const eventName = String(meta.event_name || "");
  const eventId = String(meta.event_id || "");
  const data = payload?.data || {};
  const attrs = data?.attributes || {};

  // Idempotency: if we already processed this event_id, acknowledge it without
  // touching billing state again (Lemon Squeezy retries until it gets a 2xx).
  if (eventId) {
    try {
      const { data: existing } = await supabase.from("webhook_events").select("event_id").eq("event_id", eventId).maybeSingle();
      if (existing) return { ok: true, already: true };
    } catch (e) {
      console.error("[billing] webhook_events lookups unavailable:", e.message);
    }
  }

  if (eventId) {
    try {
      await supabase.from("webhook_events").insert({
        event_id: eventId,
        event_name: eventName,
        payload: payload,
        processed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[billing] webhook_events insert unavailable:", e.message);
    }
  }

  const userId = String(meta.custom_data?.user_id || attrs.user_id || "");
  const variantId = data.type === "subscriptions" ? attrs.variant_id : null;
  const tier = tierForVariant(variantId);

  if (!userId) {
    console.warn("[billing] webhook without user_id (custom_data) — skipping entitlement", eventName, eventId);
    return { ok: true, skipped: "no-user" };
  }

  let active = Boolean(tier) && KEEPS_ENTITLEMENT.has(String(attrs.status || ""));
  const plan = active ? tier : "free";

  if (eventName === "subscription_expired") {
    if (data.type === "subscriptions") {
      await safeUpsert(
        supabase,
        "subscriptions",
        {
          user_id: userId,
          lemon_squeezy_subscription_id: String(data.id || ""),
          lemon_squeezy_customer_id: String(attrs.customer_id || ""),
          variant_id: String(attrs.variant_id || ""),
          status: String(attrs.status || ""),
          tier: "free",
          renews_at: normalizeISO(attrs.renews_at),
          cancel_at_period_end: Boolean(attrs.cancelled),
          updated_at: new Date().toISOString(),
        },
        "user_id"
      );
    }
    const done = await setEntitlement(supabase, userId, "free");
    return { ok: true, plan: "free", done };
  }

  // For trial, active, paused, cancelled, unpaid — record + entitlement.
  if (data.type === "subscriptions" && tier) {
    await safeUpsert(
      supabase,
      "subscriptions",
      {
        user_id: userId,
        lemon_squeezy_subscription_id: String(data.id || ""),
        lemon_squeezy_customer_id: String(attrs.customer_id || ""),
        variant_id: String(attrs.variant_id || ""),
        product_id: String(attrs.product_id || ""),
        status: String(attrs.status || ""),
        tier,
        renews_at: normalizeISO(attrs.renews_at),
        cancel_at_period_end: Boolean(attrs.cancelled),
        updated_at: new Date().toISOString(),
      },
      "user_id"
    );
    const done = await setEntitlement(supabase, userId, plan);
    return { ok: true, plan, done };
  }

  if (eventName === "subscription_paid" || eventName === "subscription_payment_success") {
    const status = String(attrs.status || "active");
    if (tier && KEEPS_ENTITLEMENT.has(status)) {
      await safeUpsert(
        supabase,
        "subscriptions",
        {
          user_id: userId,
          lemon_squeezy_subscription_id: String(data.id || ""),
          lemon_squeezy_customer_id: String(attrs.customer_id || ""),
          variant_id: String(attrs.variant_id || ""),
          product_id: String(attrs.product_id || ""),
          status,
          tier,
          renews_at: normalizeISO(attrs.renews_at),
          cancel_at_period_end: Boolean(attrs.cancelled),
          updated_at: new Date().toISOString(),
        },
        "user_id"
      );
      await setEntitlement(supabase, userId, tier);
    }
    return { ok: true };
  }

  return { ok: true, unhandled: eventName };
};

const normalizeISO = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ---------------------------------------------------------------------------
// Auth'd actions
// ---------------------------------------------------------------------------

const readSubscriptionForUser = async (supabase, userId) => {
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
};

const createCheckout = async (tier, userId, email) => {
  const variantId =
    tier === "ultimate" ? Deno.env.get("LEMON_SQUEEZY_ULTIMATE_VARIANT_ID") : Deno.env.get("LEMON_SQUEEZY_PRO_VARIANT_ID");
  const redirectUrl = Deno.env.get("LEMON_SQUEEZY_REDIRECT_URL");

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          custom: { user_id: String(userId) },
          ...(email ? { email } : {}),
        },
        ...(redirectUrl ? { product_options: { redirect_url: redirectUrl } } : {}),
        checkout_options: {
          ...(email ? {} : { collect_billing_details: true }),
        },
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        preview: false,
      },
      relationships: {
        store: { data: { type: "stores", id: Deno.env.get("LEMON_SQUEEZY_STORE_ID") } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await fetch(`${LS_API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LEMON_SQUEEZY_API_KEY")}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.errors?.map((e) => e.detail).join("; ") || res.statusText;
    throw new Error(`Lemon Squeezy checkout failed: ${detail}`);
  }
  return data?.data?.attributes?.url || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signature = req.headers.get("x-signature") || "";

  try {
    // ---- Webhook route ------------------------------------------------------
    // Lemon Squeezy signs every webhook with X-Signature. Presence of that
    // header (and the absence of a user JWT) is what marks a webhook request
    // — client calls never carry it. Signature is verified before ANY billing
    // state is touched.
    if (signature) {
      const raw = await req.text();
      const body = raw ? JSON.parse(raw) : {};
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false } }
      );
      const valid = await verifySignature(Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET"), raw, signature);
      if (!valid) {
        console.error("[billing] webhook signature mismatch");
        return json({ error: "Invalid signature" }, 401);
      }
      const result = await handleWebhook(supabase, body, raw);
      return json(result);
    }

    // ---- Authenticated client actions ---------------------------------------
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }
    );
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { raw, body } = await textBody(req);
    const action = body.action || "status";

    if (action === "status") {
      const configured = isConfigured();
      // Read the subscription regardless of `configured`: a user entitled
      // before Lemon Squeezy lost its env vars must not silently drop to
      // "free" because this deployment is currently unconfigured.
      const sub = await readSubscriptionForUser(supabase, user.id);
      return json({
        configured,
        subscription: sub,
        // SECURITY: sourced from the server-owned `subscriptions` row, never
        // from `user.user_metadata.plan`. The client feeds this straight into
        // can(), so reading the self-writable mirror here would let any user
        // unlock the paid UI for themselves.
        plan: effectiveTier(sub),
      });
    }

    if (action === "checkout") {
      if (!isConfigured()) return json({ configured: false, error: "Billing is not configured for this deployment yet." });
      const tier = String(body.tier || "").toLowerCase() === "ultimate" ? "ultimate" : "pro";
      const checkoutUrl = await createCheckout(tier, user.id, user.email);
      if (!checkoutUrl) throw new Error("Checkout URL not returned");
      return json({ configured: true, checkoutUrl });
    }

    if (action === "manage") {
      const sub = await readSubscriptionForUser(supabase, user.id);
      const portalUrl = sub?.update_payment_method_url || null;
      return json({ portalUrl });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("[billing] error:", error.message);
    return json({ error: error.message }, 500);
  }
});