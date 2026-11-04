import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

// Depende de banco real: só roda com INTEGRATION_TESTS=1 e um .env do projeto.
const canRunIntegration = process.env["INTEGRATION_TESTS"] === "1" && existsSync(`${process.cwd()}/.env`);

describe.skipIf(!canRunIntegration)("ficha do estabelecimento (integração real)", () => {
  it("carrega a ficha para um negócio real sem erros", async () => {
    // Simula o guard com a sessão real: sem mock de createServerFn, não é possível
    // chamar o server fn direto. Em vez disso, executamos as queries do dossier
    // via supabase admin (mesmo padrão do check-data.mjs) e validamos o agregado.
    const { createClient } = await import("@supabase/supabase-js");
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(process.cwd() + "/.env", "utf8");
    const get = (key: string) => {
      const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match && match[1] ? match[1].trim().replace(/^["']|["']$/g, "") : undefined;
    };
    const supabaseAdmin = createClient(get("SUPABASE_URL")!, get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { storage: undefined, persistSession: false },
    });

    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("slug", "barber-richard-185w")
      .maybeSingle();
    expect(error).toBeNull();
    expect(business).not.toBeNull();
    if (!business) return;

    const [appts, customers, notes, events] = await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select(
          "id, status, starts_at, created_at, service_id, professional_id, customer_id, customer_name, customer_phone",
        )
        .eq("business_id", business.id)
        .limit(20000),
      supabaseAdmin
        .from("customers")
        .select("id, created_at")
        .eq("business_id", business.id)
        .limit(20000),
      supabaseAdmin.from("master_business_notes").select("id").eq("business_id", business.id),
      supabaseAdmin.from("master_business_events").select("id").eq("business_id", business.id),
    ]);
    expect(appts.error).toBeNull();
    expect(customers.error).toBeNull();
    expect(notes.error).toBeNull();
    expect(events.error).toBeNull();
    expect((appts.data ?? []).length).toBeGreaterThan(0);
  }, 60_000);
});
