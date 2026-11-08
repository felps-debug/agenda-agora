import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAllowedAppOrigins } from "@/lib/env-security.server";
import {
  safeErrorText,
  safeErrorSource,
  safeErrorDetail,
  type ClientErrorDatabase,
} from "./client-error-data";

const kinds = z.enum(["ui_error", "unhandled_rejection", "request_failed"]);
// This scoped schema covers the additive migration until generated DB types are refreshed.
const errorClient = (client: unknown) => client as SupabaseClient<ClientErrorDatabase>;
const rateBuckets = new Map<string, { start: number; count: number }>();

function canRecord(key: string) {
  const now = Date.now();
  for (const [entry, bucket] of rateBuckets)
    if (now - bucket.start >= 60_000) rateBuckets.delete(entry);
  const bucket = rateBuckets.get(key);
  if (bucket) {
    bucket.count++;
    return bucket.count <= 10;
  }
  if (rateBuckets.size >= 2000) return false;
  rateBuckets.set(key, { start: now, count: 1 });
  return true;
}

export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: kinds,
        message: z.string().max(10000),
        source: z.string().max(4000),
        detail: z.record(z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      // Public booking errors also matter. Accept same-origin, bounded reports only;
      // never expose a direct anonymous INSERT policy or trust a supplied user id.
      const request = getRequest();
      const origin = request.headers.get("origin") ?? new URL(request.url).origin;
      if (!getAllowedAppOrigins().has(origin)) return { ok: true as const };
      const clientKey = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").slice(
        0,
        120,
      );
      if (!canRecord(clientKey)) return { ok: true as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
      let userId: string | null = null;
      if (token) {
        const { data: auth, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !auth.user) return { ok: true as const };
        userId = auth.user.id;
      }
      await errorClient(supabaseAdmin)
        .from("client_error_log")
        .insert({
          kind: data.kind,
          message: safeErrorText(data.message),
          source: safeErrorSource(data.source),
          detail: safeErrorDetail(data.detail),
          user_id: userId,
        });
    } catch {
      /* Monitoring must never cascade into another UI failure. */
    }
    return { ok: true as const };
  });

export const listClientErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(30),
        cursor: z.string().max(100).optional(),
        kind: kinds.optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertSuperAdmin(context);
    let query = errorClient(admin)
      .from("client_error_log")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit + 1);
    if (data.kind) query = query.eq("kind", data.kind);
    if (data.cursor) {
      const [at, id] = data.cursor.split("|");
      const cursor = z
        .object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() })
        .parse({ at, id });
      query = query.or(
        `occurred_at.lt.${cursor.at},and(occurred_at.eq.${cursor.at},id.lt.${cursor.id})`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível consultar os erros de produção.");
    const items = (rows ?? [])
      .slice(0, data.limit)
      .map((row) => ({ ...row, detail: safeErrorDetail(row.detail) }));
    const last = items.at(-1);
    return {
      items,
      cursor: (rows?.length ?? 0) > data.limit && last ? `${last.occurred_at}|${last.id}` : null,
    };
  });
