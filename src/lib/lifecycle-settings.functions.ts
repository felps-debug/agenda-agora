import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { getSetting, setSetting } from "@/lib/platform-settings.server";

export const getLifecycleAutoCancel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    return { enabled: await getSetting("lifecycle_auto_cancel_enabled", false) };
  });

export const setLifecycleAutoCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    await setSetting("lifecycle_auto_cancel_enabled", data.enabled, context.userId);
    return { enabled: data.enabled };
  });
