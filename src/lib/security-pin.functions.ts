import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { getMasterSecurityPin } from "@/lib/env-security.server";
import { checkLock, registerFailure, registerSuccess } from "@/lib/login-attempts.server";

export const verifySecurityPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pin: z.string().regex(/^\d{6,12}$/) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const key = `pin:${context.userId}`;
    const lock = await checkLock(key);
    if (lock.locked) throw new Error(`TOO_MANY_ATTEMPTS:${lock.retryAfterSeconds}`);
    const expected = Buffer.from(getMasterSecurityPin());
    const actual = Buffer.from(data.pin);
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      const result = await registerFailure(key, {
        limit: 5,
        windowMs: 15 * 60_000,
        lockMs: 30 * 60_000,
      });
      if (result.locked) throw new Error(`TOO_MANY_ATTEMPTS:${result.retryAfterSeconds}`);
      throw new Error("INVALID_PIN");
    }
    await registerSuccess(key);
    return { ok: true as const, validUntil: Date.now() + 10 * 60_000 };
  });
