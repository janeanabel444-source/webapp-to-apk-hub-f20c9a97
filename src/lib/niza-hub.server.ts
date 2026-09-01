/**
 * Niza Hub client — server-only.
 *
 * Niza Hub (https://niza-hub-app.lovable.app) is the central identity,
 * SSO, payment and subscription server for the Niza ecosystem. This module
 * speaks its documented `/api/public/v1/*` contract.
 *
 * Design rules baked in here:
 *  - Hub is ALWAYS tried first. Paystack is only a fallback.
 *  - Every call is time-boxed so a slow/absent Hub can never hang the app.
 *  - Nothing throws on transport failure: callers get `{ ok: false }` and
 *    decide whether to fall back.
 */

const DEFAULT_BASE_URL = "https://niza-hub-app.lovable.app";
const TIMEOUT_MS = 12_000;

export type HubResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export function hubConfig() {
  const baseUrl = (process.env.NIZA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const appId = process.env.NIZA_APP_ID;
  const appSecret = process.env.NIZA_APP_SECRET;
  const workspaceId = process.env.NIZA_WORKSPACE_ID;
  return { baseUrl, appId, appSecret, workspaceId };
}

/** True when the four credentials needed for authenticated Hub calls exist. */
export function isHubConfigured() {
  const c = hubConfig();
  return Boolean(c.baseUrl && c.appId && c.appSecret && c.workspaceId);
}

async function hubFetch<T>(path: string, body: Record<string, unknown>): Promise<HubResult<T>> {
  const { baseUrl, appId, appSecret, workspaceId } = hubConfig();
  if (!appId || !appSecret || !workspaceId) {
    return { ok: false, status: 0, error: "Niza Hub credentials are not configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-app-id": appId,
        "x-workspace-id": workspaceId,
        authorization: `Bearer ${appSecret}`,
      },
      body: JSON.stringify({
        app_id: appId,
        workspace_id: workspaceId,
        ...body,
      }),
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Hub returned HTML (endpoint not served yet) — treat as unavailable.
      return { ok: false, status: res.status, error: "Niza Hub endpoint unavailable." };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parsed?.error || parsed?.message || `Niza Hub error ${res.status}`,
      };
    }
    return { ok: true, data: parsed as T };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      error: e?.name === "AbortError" ? "Niza Hub timed out." : (e?.message ?? "Niza Hub unreachable."),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────── Identity ───────────────

export type HubAuthResponse = {
  global_user_id: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  user?: { email?: string; full_name?: string };
};

export function hubRegister(input: {
  email: string;
  password: string;
  fullName?: string | null;
}) {
  return hubFetch<HubAuthResponse>("/api/public/v1/auth/register", {
    email: input.email,
    password: input.password,
    user: { full_name: input.fullName ?? null },
  });
}

export function hubLogin(input: { email: string; password: string }) {
  return hubFetch<HubAuthResponse>("/api/public/v1/auth/login", {
    email: input.email,
    password: input.password,
  });
}

// ─────────────── Single sign-on ───────────────

export function hubSsoCreate(nizaUserToken: string) {
  return hubFetch<{ session_token: string; refresh_token?: string; expires_at?: string }>(
    "/api/public/v1/sso/session/create",
    { nova_user_token: nizaUserToken },
  );
}

export function hubSsoVerify(sessionToken: string) {
  return hubFetch<{ global_user_id?: string; valid?: boolean; user?: { email?: string } }>(
    "/api/public/v1/sso/session/verify",
    { session_token: sessionToken },
  );
}

export function hubSsoRevoke(sessionToken: string, scope: "local" | "global" = "local") {
  return hubFetch<{ revoked?: boolean }>("/api/public/v1/sso/session/revoke", {
    session_token: sessionToken,
    scope,
  });
}

// ─────────────── Payments ───────────────

export type HubPaymentInit = {
  authorization_url: string;
  access_code?: string;
  reference: string;
};

export function hubInitializePayment(input: {
  globalUserId: string | null;
  productId: string;
  /** Major units, e.g. 5000 = ₦5,000. */
  amount: number;
  currency: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  return hubFetch<HubPaymentInit>("/api/public/v1/payments/initialize", {
    global_user_id: input.globalUserId,
    product_id: input.productId,
    amount: input.amount,
    currency: input.currency,
    callback_url: input.callbackUrl,
    metadata: input.metadata ?? {},
  });
}

export function hubSubscriptionStatus(globalUserId: string, productId?: string) {
  return hubFetch<{
    subscriptions: Array<{
      product_id: string;
      status: string;
      renews_at?: string;
      expires_at?: string;
      auto_renew?: boolean;
    }>;
  }>("/api/public/v1/subscriptions/status", {
    global_user_id: globalUserId,
    ...(productId ? { product_id: productId } : {}),
  });
}

// ─────────────── Catalog ───────────────

export function hubSyncCatalog(
  products: Array<{
    product_id: string;
    name: string;
    type: "subscription" | "one_time" | "feature";
    amount: number;
    currency: string;
    interval?: "monthly" | "yearly" | null;
    metadata?: Record<string, unknown>;
  }>,
) {
  return hubFetch<{ synced: number; created: number; updated: number }>(
    "/api/public/v1/catalog/sync",
    { products },
  );
}
