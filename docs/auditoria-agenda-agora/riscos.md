# Prioritized risk index

Reconstructed on 2026-11-15 from relatorio-consolidado.md, the detailed finding reports and current local validations. The prior literal risk table was not recoverable. This index groups findings as the consolidated report did; linked reports contain the full evidence, impact, reproduction and limitations.

## P1 risks and coverage groups

| Group | Finding IDs | Current state | Risk or evidence gap | Source |
|---|---|---|---|---|
| R01 | PAY-009 / PAY-011 | Fixed locally; no real cashout | PIN and current approved PIX recipient are checked server-side; external payouts remain untested. | [pagamentos.md](pagamentos.md) |
| R02 | BOOK-001 | Partially mitigated; rollout and late-payment policy open | Deposit holds occupy slots locally; late confirmation can still need financial reconciliation. | [agendamentos.md](agendamentos.md) |
| R03 | PAY-014 | Fixed locally; production unverified | Mismatched amounts are held for review; remote reconciliation has not been inspected. | [pagamentos.md](pagamentos.md) |
| R04 | DEP-007 | Operational observation from 2026-11-13; current state unknown | Reminder jobs and AgPay calls showed secret mismatch/401; per-payment impact and current queue were not checked. | [infraestrutura.md](infraestrutura.md) |
| R05 | PAY-006 | External configuration unknown | AgPay dashboard may apply global split rules not represented in the local payload/ledger. | [pagamentos.md](pagamentos.md) |
| R06 | PAY-017 | Blocked on provider contract and product policy | Repeated calls may create distinct subscription PIX charges; no provider idempotency/reconciliation contract confirmed. | [pagamentos.md](pagamentos.md) |
| R07 | PAY-027 | Fixed locally; remote migration unverified | Trial logic now checks prior successful payments; deployed behavior and affected accounts not inspected. | [pagamentos.md](pagamentos.md) |
| R08 | BOOK-004 | Fixed locally; deployment unverified | Public catalog/reservation checks require an active, non-cancelled business; live behavior not verified. | [agendamentos.md](agendamentos.md) |
| R09 | PAY-032 | Mitigated locally; recovery not exercised | Failed persistence records an item for Master reconciliation; no real provider failure or recovery was run. | [pagamentos.md](pagamentos.md) |
| R10 | PAY-036 | Mitigated locally; provider semantics unknown | Ambiguous responses keep funds reserved, but external 422/success:false semantics remain unverified. | [pagamentos.md](pagamentos.md) |
| R11 | SEC-006 / SEC-009 / SEC-010 / SEC-016 / DEP-001 | Local controls partly fixed; remote exposure unknown | MFA/AAL2, customer/business RLS, direct business writes and dependency/runtime exposure require deployed-state evidence; SEC-009/010 also need projection design. | [seguranca.md](seguranca.md) |
| R12 | PAY-004 / DB-002 / INT-007 / SEC-002 | Production coverage blocked | AgPay dashboard, current Supabase policies/schema, queue effects and Evolution-to-business associations were not verified. | [relatorio-consolidado.md](relatorio-consolidado.md) |
| R13 | SEC-024 | Headers configured locally; deploy unverified | Caddy/Vercel set anti-framing headers, but active hosts and external edge behavior were not checked. | [seguranca.md](seguranca.md) |

## Additional P2 watch items

| Finding IDs | Current state | Risk or decision | Source |
|---|---|---|---|
| PAY-012 | Pending accounting definition | Report filters by creation date while paid recognition semantics are undefined. | [pagamentos.md](pagamentos.md) |
| PAY-024 | Blocked on cancellation-state policy | Payment renews access, but clearing a shared cancellation marker could reactivate a deliberate cancellation. | [pagamentos.md](pagamentos.md) |