import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logClientError } from "@/lib/error-log.functions";
import { installErrorCollector } from "@/lib/error-collector";

export function ClientErrorMonitor() {
  const log = useServerFn(logClientError);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    return installErrorCollector(async (error) => {
      await log({ data: error });
    });
  }, [log]);
  return null;
}
