export type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  notes?: string | null;
};

export type AppointmentCustomer = {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  status: string;
};

export type ListedCustomer = CustomerRecord & {
  lastAppointmentAt: string | null;
  manual: boolean;
};

export function normalizeCustomerPhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function mergeAppointmentCustomers(
  manual: CustomerRecord[],
  appointments: AppointmentCustomer[],
): ListedCustomer[] {
  const latestByPhone = new Map<string, AppointmentCustomer>();
  const latestCompletedByPhone = new Map<string, AppointmentCustomer>();
  const latestById = new Map<string, string>();
  for (const appointment of appointments) {
    if (appointment.status === "concluido" && appointment.customer_id) {
      const previous = latestById.get(appointment.customer_id);
      if (!previous || appointment.starts_at > previous)
        latestById.set(appointment.customer_id, appointment.starts_at);
    }
    const phone = normalizeCustomerPhone(appointment.customer_phone);
    if (!phone) continue;
    const previous = latestByPhone.get(phone);
    if (!previous || appointment.starts_at > previous.starts_at)
      latestByPhone.set(phone, appointment);
    if (appointment.status === "concluido") {
      const previousCompleted = latestCompletedByPhone.get(phone);
      if (!previousCompleted || appointment.starts_at > previousCompleted.starts_at)
        latestCompletedByPhone.set(phone, appointment);
    }
  }

  const manualPhones = new Set(
    manual.map((customer) => normalizeCustomerPhone(customer.phone)).filter(Boolean),
  );
  const rows: ListedCustomer[] = manual.map((customer) => ({
    ...customer,
    lastAppointmentAt: latestById.get(customer.id) ?? null,
    manual: true,
  }));
  for (const [phone, appointment] of latestByPhone) {
    const completed = latestCompletedByPhone.get(phone);
    if (manualPhones.has(phone)) {
      const existing = rows.find((row) => normalizeCustomerPhone(row.phone) === phone);
      if (existing && completed && completed.starts_at > (existing.lastAppointmentAt ?? ""))
        existing.lastAppointmentAt = completed.starts_at;
      continue;
    }
    rows.push({
      id: `appointment:${phone}`,
      name: appointment.customer_name.trim() || "Cliente sem nome",
      phone: appointment.customer_phone,
      email: null,
      notes: null,
      lastAppointmentAt: completed?.starts_at ?? null,
      manual: false,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
