export type ReportAppointment = {
  status: string;
  service_id: string | null;
  professional_id: string | null;
};

export function completedReportMetrics<T extends ReportAppointment>(
  appointments: T[],
  services: { id: string; name: string; price_cents: number }[],
  professionals: { id: string; name: string }[],
) {
  const completed = appointments.filter((appointment) => appointment.status === "concluido");
  const byService = services
    .map((service) => {
      const total = completed.filter((appointment) => appointment.service_id === service.id).length;
      return { name: service.name, total, valor: total * service.price_cents };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const byProfessional = professionals
    .map((professional) => ({
      name: professional.name,
      total: completed.filter((appointment) => appointment.professional_id === professional.id)
        .length,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  return {
    done: completed.length,
    revenue: completed.reduce(
      (total, appointment) =>
        total +
        (services.find((service) => service.id === appointment.service_id)?.price_cents ?? 0),
      0,
    ),
    byService,
    byProfessional,
  };
}
