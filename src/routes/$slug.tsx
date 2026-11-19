import { createFileRoute } from "@tanstack/react-router";
import { publicBookingRouteOptions } from "@/components/public-booking/public-booking-page";

// Link curto do cliente final: agendas.link/<nome-do-estabelecimento>.
// Rotas estáticas (/auth, /painel, /sdr...) têm prioridade sobre esta.
export const Route = createFileRoute("/$slug")({ ...publicBookingRouteOptions });
