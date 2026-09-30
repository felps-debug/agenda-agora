export function canRenderRescheduleForm(appointmentStatus: string, isSelected: boolean): boolean {
  return appointmentStatus === "agendado" && isSelected;
}

export function shouldRenderDepositStep(chargeStatus: string): boolean {
  return chargeStatus !== "sem_sinal";
}

export function formatAppointmentDateTime(startsAt: string, timezone: string): string {
  return new Date(startsAt).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}
