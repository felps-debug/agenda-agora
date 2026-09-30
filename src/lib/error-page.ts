type ValidationIssue = {
  code?: unknown;
  path?: unknown;
  message?: unknown;
  received?: unknown;
  expected?: unknown;
};

const FIELD_NAMES: Record<string, string> = {
  amount: "Valor",
  price: "Valor",
  valor: "Valor",
  duration: "Duração",
  duration_minutes: "Duração",
  name: "Nome",
  title: "Nome",
  description: "Descrição",
  phone: "Telefone",
  email: "e-mail",
  cpf: "CPF",
  cnpj: "CNPJ",
  date: "Data",
  time: "Horário",
  starts_at: "Horário",
  listing_time_minutes: "Intervalo entre horários",
  deposit_amount: "Valor do sinal",
  deposit_percent: "Percentual do sinal",
};

function parseIssues(value: unknown): ValidationIssue[] | null {
  if (Array.isArray(value)) return value as ValidationIssue[];
  if (!value || typeof value !== "object") return null;
  const candidate = value as { issues?: unknown; errors?: unknown };
  if (Array.isArray(candidate.issues)) return candidate.issues as ValidationIssue[];
  if (Array.isArray(candidate.errors)) return candidate.errors as ValidationIssue[];
  return null;
}

function validationMessage(issues: ValidationIssue[]): string | null {
  const issue = issues[0];
  if (!issue) return null;
  const path = Array.isArray(issue.path) ? issue.path : [];
  const key = path.length ? String(path[path.length - 1]) : "";
  const field = FIELD_NAMES[key.toLowerCase()] ?? "informado";
  if (
    issue.code === "invalid_type" &&
    (issue.received === "undefined" || issue.received === undefined)
  ) {
    return `O campo ${field} é obrigatório.`;
  }
  if (issue.code === "too_small") return `O campo ${field} está abaixo do mínimo permitido.`;
  if (issue.code === "too_big") return `O campo ${field} excede o limite permitido.`;
  if (issue.code === "invalid_string" || issue.code === "invalid_format") {
    return `Confira o formato do campo ${field}.`;
  }
  return `Confira o campo ${field}.`;
}

function getStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = value.status ?? value.statusCode ?? value.response?.status;
  return typeof status === "number" ? status : null;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const value = error as { message?: unknown; cause?: unknown; name?: unknown };
  if (typeof value.message === "string") return value.message;
  if (typeof value.cause === "string") return value.cause;
  return "";
}

function isSafePortugueseMessage(message: string): boolean {
  if (
    !message ||
    message.length > 240 ||
    /[{}<>\n\r]/.test(message) ||
    message.includes("[") ||
    message.includes("]")
  )
    return false;
  if (
    /\b(?:AgPay|invalid_type|expected|received|undefined|null|stack|traceback|sqlstate|postgres|supabase|zod|exception|error\s*\d{3,}|\b\w+_\w+\b)\b/i.test(
      message,
    )
  )
    return false;
  if (/\bat\s+\S+\s*\(/i.test(message) || /https?:\/\//i.test(message)) return false;
  return (
    /[áàâãéêíóôõúç]/i.test(message) ||
    /\b(?:não|nao|você|voce|seu|sua|este|esta|esse|essa|informe|escolha|confira|tente|aguarde|cadastre|selecione|horário|serviço|negócio|agendamento|valor|telefone|e-mail|senha|acesso|prazo|sinal|reserva|pix|imagem|logotipo|saldo|saque|cancelamento|remarcação)\b/i.test(
      message,
    )
  );
}

export function friendlyError(error: unknown, context?: string): string {
  const message = errorMessage(error);
  let parsed: unknown = error;
  if (
    typeof message === "string" &&
    (message.trim().startsWith("[") || message.trim().startsWith("{"))
  ) {
    try {
      parsed = JSON.parse(message);
    } catch {
      /* Mensagem simples ou texto técnico. */
    }
  }
  const issues = parseIssues(parsed);
  if (issues) return validationMessage(issues) ?? "Confira os dados informados.";

  if (
    error &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "AgpayApiError"
  ) {
    return "Não foi possível concluir o pagamento agora. Tente novamente em instantes ou fale com o estabelecimento.";
  }

  const status = getStatus(error);
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Você não tem permissão para fazer isso. Confira seu acesso.";
  if (status !== null && status >= 500)
    return "O serviço está indisponível no momento. Tente novamente em instantes.";
  if (/\b(?:failed to fetch|network|fetch failed|offline|conexão|conexao|rede)\b/i.test(message)) {
    return "Não foi possível conectar. Confira sua internet e tente novamente.";
  }
  if (/\b(?:timeout|timed out|aborted|aborterror|tempo limite)\b/i.test(message)) {
    return "A operação demorou mais que o esperado. Tente novamente.";
  }
  if (/\b(?:401|unauthorized|session expired|jwt expired)\b/i.test(message)) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (/\b(?:403|forbidden|permission denied)\b/i.test(message)) {
    return "Você não tem permissão para fazer isso. Confira seu acesso.";
  }
  if (/\b(?:500|internal server|\b5\d\d\b)\b/i.test(message)) {
    return "O serviço está indisponível no momento. Tente novamente em instantes.";
  }
  if (isSafePortugueseMessage(message)) return message;
  return context
    ? `Não foi possível ${context}. Tente novamente.`
    : "Não foi possível concluir esta ação. Tente novamente.";
}

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
