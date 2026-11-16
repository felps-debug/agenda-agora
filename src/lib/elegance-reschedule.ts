import type { EleganceHistoryBooking } from "@/components/public-booking/elegance-history";

export function getRescheduleAvailabilityInput(
  slug: string,
  booking: Pick<EleganceHistoryBooking, "serviceId" | "professionalId">,
  date: string,
) {
  if (!booking.serviceId) return null;

  return {
    slug,
    serviceId: booking.serviceId,
    date,
    professionalId: booking.professionalId,
  };
}

export function getRescheduleSlotsMessage(input: {
  date: string;
  isFetching: boolean;
  isError: boolean;
  slots?: string[] | undefined;
}) {
  if (!input.date) return "Escolha a data";
  if (input.isFetching) return "Carregando...";
  if (input.isError) return "Erro ao carregar horários";
  if (input.slots?.length) return "Selecione";
  return "Sem horários";
}
