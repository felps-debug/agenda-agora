import { createFileRoute } from "@tanstack/react-router";
import { publicBookingRouteOptions } from "@/components/public-booking/public-booking-page";

export const Route = createFileRoute("/agendar/$slug")({ ...publicBookingRouteOptions });
