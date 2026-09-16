import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid().nullable().optional(),
});

type Ctx = {
  businessId: string;
  service: { id: string; name: string; duration_minutes: number; deposit_cents: number };
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toIso(date: string, time: string) {
  // Horários do negócio são interpretados no fuso de São Paulo (UTC-3).
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function minutesOf(t: string) {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function loadContext(slug: string, serviceId: string): Promise<Ctx> {
  const db = await admin();
  const { data: business } = await db
    .from("businesses")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  if (business.status === "suspenso")
    throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
  const { data: service } = await db
    .from("services")
    .select("id, name, duration_minutes, deposit_cents")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (!service) throw new Error("Serviço não encontrado.");
  return { businessId: business.id, service };
}

async function validateProfessional(businessId: string, serviceId: string, professionalId?: string | null) {
  const db = await admin();
  const { data: links } = await db.from("service_professionals").select("professional_id").eq("business_id", businessId).eq("service_id", serviceId);
  if (!links?.length) return null;
  if (!professionalId || !links.some((link) => link.professional_id === professionalId)) throw new Error("Selecione um profissional disponível.");
  const { data: professional } = await db.from("professionals").select("id, name, active, working_days").eq("id", professionalId).eq("business_id", businessId).maybeSingle();
  if (!professional?.active) throw new Error("Esse profissional não está disponível.");
  return professional;
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const weekday = new Date(`${data.date}T12:00:00-03:00`).getDay();
    const professional = await validateProfessional(businessId, service.id, data.professionalId);
    if (professional && !professional.working_days.includes(weekday)) return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: hours } = await db
      .from("business_hours")
      .select("starts_at, ends_at")
      .eq("business_id", businessId)
      .eq("weekday", weekday);
    if (!hours?.length) return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: blocks } = await db
      .from("time_blocks")
      .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
      .eq("business_id", businessId);

    const dayStart = toIso(data.date, "00:00");
    const dayEnd = toIso(data.date, "23:59");
    const { data: appts } = await db
      .from("appointments")
      .select("starts_at, ends_at, status, professional_id")
      .eq("business_id", businessId)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const busy: [number, number][] = [];
    for (const b of blocks ?? []) {
      const matches = b.recurring ? b.weekday === weekday : b.block_date === data.date;
      const sameProf = !b.professional_id || b.professional_id === data.professionalId;
      if (matches && sameProf)
        busy.push([minutesOf(b.starts_at.slice(0, 5)), minutesOf(b.ends_at.slice(0, 5))]);
    }
    for (const a of appts ?? []) {
      if (a.status === "cancelado" || a.status === "aguardando_sinal") continue;
      if (data.professionalId && a.professional_id && a.professional_id !== data.professionalId)
        continue;
      const s = new Date(a.starts_at);
      const e = new Date(a.ends_at);
      const off = (d: Date) =>
        Number(
          d.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).slice(0, 2),
        ) *
          60 +
        Number(
          d
            .toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .slice(3, 5),
        );
      busy.push([off(s), off(e)]);
    }

    const nowMin =
      data.date ===
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
        ? (() => {
            const t = new Date().toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return minutesOf(t);
          })()
        : -1;

    const slots: string[] = [];
    for (const h of hours) {
      const from = minutesOf(h.starts_at.slice(0, 5));
      const to = minutesOf(h.ends_at.slice(0, 5));
      for (let t = from; t + service.duration_minutes <= to; t += 30) {
        const end = t + service.duration_minutes;
        if (t <= nowMin) continue;
        if (busy.some(([bs, be]) => t < be && end > bs)) continue;
        slots.push(hhmm(t));
      }
    }
    return { slots, depositCents: service.deposit_cents };
  });

export const getOpenDays = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: business } = await db
      .from("businesses")
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!business || business.status === "suspenso")
      return { days: [] as { date: string; weekday: number }[] };
    const { data: hours } = await db
      .from("business_hours")
      .select("weekday")
      .eq("business_id", business.id);
    const open = new Set((hours ?? []).map((h) => h.weekday));
    const days: { date: string; weekday: number }[] = [];
    for (let i = 0; i < 21 && days.length < 12; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const date = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
      if (open.has(weekday)) days.push({ date, weekday });
    }
    return { days };
  });

export const reserveBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    slugSchema
      .extend({
        time: z.string().regex(/^\d{2}:\d{2}$/),
        customerName: z.string().min(2).max(80),
        customerPhone: z.string().min(8).max(20),
        notes: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    await validateProfessional(businessId, service.id, data.professionalId);
    if (!service.deposit_cents || service.deposit_cents <= 0)
      throw new Error("Este serviço ainda não tem valor de sinal configurado.");

    const startsAt = toIso(data.date, data.time);
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.duration_minutes * 60_000,
    ).toISOString();

    let clashQuery = db
      .from("appointments")
      .select("id")
      .eq("business_id", businessId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt)
      .not("status", "in", '("cancelado","aguardando_sinal")');
    if (data.professionalId) clashQuery = clashQuery.eq("professional_id", data.professionalId);
    const { data: clash } = await clashQuery.limit(1);
    if (clash?.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");

    const { data: appointment, error: apptError } = await db
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id: service.id,
        professional_id: data.professionalId ?? null,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "aguardando_sinal",
        deposit_cents: service.deposit_cents,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (apptError?.code === "23P01") throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
    if (apptError || !appointment) throw new Error(apptError?.message ?? "Falha ao reservar.");

    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { data: charge, error: chargeError } = await db
      .from("deposit_payments")
      .insert({
        business_id: businessId,
        appointment_id: appointment.id,
        amount_cents: service.deposit_cents,
        status: "pendente",
        payer_name: data.customerName,
        payer_phone: data.customerPhone,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (chargeError || !charge) throw new Error(chargeError?.message ?? "Falha ao criar cobrança.");

    return {
      chargeId: charge.id,
      appointmentId: appointment.id,
      amountCents: service.deposit_cents,
      serviceName: service.name,
      startsAt,
      expiresAt,
    };
  });

export const generateDepositPix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: charge } = await db
      .from("deposit_payments")
      .select("id, amount_cents, status, payer_name, qr_code, qr_code_base64, ticket_url, expires_at")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status !== "pendente") throw new Error("Essa cobrança não está mais ativa.");
    if (charge.qr_code)
      return {
        qrCode: charge.qr_code,
        qrCodeBase64: charge.qr_code_base64,
        ticketUrl: charge.ticket_url,
        expiresAt: charge.expires_at,
      };

    const { createPixCharge } = await import("./mercadopago.server");
    const pix = await createPixCharge({
      amountCents: charge.amount_cents,
      description: "Sinal do agendamento",
      payerName: charge.payer_name ?? "Cliente",
      payerEmail: `sinal+${charge.id}@agendaagora.app`,
      externalReference: charge.id,
      expiresInMinutes: 5,
    });
    await db
      .from("deposit_payments")
      .update({
        provider_payment_id: pix.providerPaymentId,
        qr_code: pix.qrCode,
        qr_code_base64: pix.qrCodeBase64,
        ticket_url: pix.ticketUrl,
      })
      .eq("id", charge.id);
    return {
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      expiresAt: charge.expires_at,
    };
  });

export const cancelDepositBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: charge } = await db
      .from("deposit_payments")
      .select("id, status, appointment_id")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status === "pago") throw new Error("Esse sinal já foi pago.");
    await db.from("deposit_payments").update({ status: "cancelado" }).eq("id", charge.id);
    if (charge.appointment_id)
      await db
        .from("appointments")
        .update({ status: "cancelado" })
        .eq("id", charge.appointment_id);
    return { ok: true };
  });

export const getMyBookings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ chargeIds: z.array(z.string().uuid()).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.chargeIds.length) return { bookings: [] };
    const db = await admin();
    const { data: charges } = await db
      .from("deposit_payments")
      .select("id, status, amount_cents, payer_name, expires_at, created_at, appointment_id")
      .in("id", data.chargeIds)
      .order("created_at", { ascending: false });
    const apptIds = (charges ?? []).map((c) => c.appointment_id).filter(Boolean) as string[];
    const { data: appts } = apptIds.length
      ? await db
          .from("appointments")
          .select("id, starts_at, status, service_id, professional_id")
          .in("id", apptIds)
      : { data: [] as never[] };
    const serviceIds = [...new Set((appts ?? []).map((a) => a.service_id).filter(Boolean))];
    const { data: servicesRows } = serviceIds.length
      ? await db.from("services").select("id, name").in("id", serviceIds as string[])
      : { data: [] as never[] };
    const profIds = [...new Set((appts ?? []).map((a) => a.professional_id).filter(Boolean))];
    const { data: profs } = profIds.length
      ? await db.from("professionals").select("id, name").in("id", profIds as string[])
      : { data: [] as never[] };

    const bookings = (charges ?? []).map((c) => {
      const a = (appts ?? []).find((x) => x.id === c.appointment_id);
      const s = (servicesRows ?? []).find((x) => x.id === a?.service_id);
      const p = (profs ?? []).find((x) => x.id === a?.professional_id);
      return {
        chargeId: c.id,
        chargeStatus: c.status,
        amountCents: c.amount_cents,
        customerName: c.payer_name,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
        startsAt: a?.starts_at ?? null,
        appointmentStatus: a?.status ?? "cancelado",
        serviceName: s?.name ?? "Serviço",
        professionalName: p?.name ?? "Profissional Agenda",
      };
    });
    return { bookings };
  });


export const getDepositStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: charge } = await db
      .from("deposit_payments")
      .select("id, status, provider_payment_id, appointment_id, expires_at")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status === "pago") return { status: "pago" as const };
    if (charge.status !== "pendente") return { status: "expirado" as const };

    const expire = async () => {
      await db.from("deposit_payments").update({ status: "expirado" }).eq("id", charge.id);
      if (charge.appointment_id)
        await db
          .from("appointments")
          .update({ status: "cancelado" })
          .eq("id", charge.appointment_id);
    };

    if (charge.provider_payment_id) {
      const { fetchPaymentStatus } = await import("./mercadopago.server");
      const status = await fetchPaymentStatus(charge.provider_payment_id);
      if (status === "approved") {
        const paidAt = new Date().toISOString();
        await db
          .from("deposit_payments")
          .update({ status: "pago", paid_at: paidAt })
          .eq("id", charge.id);
        if (charge.appointment_id) {
          const { error: confirmError } = await db
            .from("appointments")
            .update({ status: "agendado", deposit_paid_at: paidAt })
            .eq("id", charge.appointment_id);
          if (confirmError) {
            // Sinal pago mas o horário colidiu com outro agendamento já confirmado
            // (duas pessoas pagaram o mesmo slot quase ao mesmo tempo). Não manda a
            // confirmação — seria mentira — e deixa registrado pra reconciliação manual.
            console.error(
              `Sinal pago sem conseguir confirmar o agendamento ${charge.appointment_id} (colisão de horário): ${confirmError.message}`,
            );
            return { status: "pago" as const };
          }
          const { sendBookingConfirmation } = await import(
            "./whatsapp-notify.server"
          );
          await sendBookingConfirmation(charge.appointment_id);
        }
        return { status: "pago" as const };
      }
      if (["cancelled", "rejected", "expired"].includes(status)) {
        await expire();
        return { status: "expirado" as const };
      }
    }
    if (charge.expires_at && new Date(charge.expires_at).getTime() < Date.now()) {
      await expire();
      return { status: "expirado" as const };
    }

    return { status: "pendente" as const };
  });
