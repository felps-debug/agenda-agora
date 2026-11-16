type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

export function requireReportDatasets<Appointment, Service, Professional>(input: {
  appointments: QueryResult<Appointment>;
  services: QueryResult<Service>;
  professionals: QueryResult<Professional>;
}) {
  for (const [source, result] of Object.entries(input)) {
    if (result.error) throw new Error(`Falha ao carregar ${source}: ${result.error.message}`);
  }

  return {
    appointments: input.appointments.data ?? [],
    services: input.services.data ?? [],
    professionals: input.professionals.data ?? [],
  };
}
