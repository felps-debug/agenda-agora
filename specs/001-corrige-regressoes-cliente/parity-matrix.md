# Parity Matrix — tela → server function → status (T005)

**Data**: 2026-11-06 · Base para US8. Status em nível de **módulo** (import presente/ausente). Validação funcional profunda (lê/grava dados reais) ocorre na Phase 10 por tela.

Legenda: `ok` = módulo existe e tela importa corretamente · `rebrand` = funciona, mas sujeito ao rebrand Ag Pay (US5) · `verificar` = exercitar ação principal na Phase 10.

| Tela (rota) | Server functions `@/lib/*` | Status |
|---|---|---|
| `painel.index` (home/agenda) | appointments.functions, business, error-page, format, format-phone | ok |
| `painel.servicos` | services.functions, business, deposit-amount, logo, format, error-page | ok (US4 estende `logo`) |
| `painel.profissionais` | professionals.functions, business, error-page | ok |
| `painel.clientes` | customer-list, business, error-page, format, format-phone | ok |
| `painel.funcionamento` | business, error-page, format | ok |
| `painel.bloqueios` | time-blocks.functions, time-blocks, business, error-page, format | ok |
| `painel.lembretes` | outreach-templates.functions, app-hosts, business | ok |
| `painel.integracoes` | whatsapp.functions, business, error-page | ok (US6 repõe "enviar teste") |
| `painel.configuracoes` | business.functions, panel1-config(.functions), business, error-page | ok |
| `painel.aparencia-editor` | panel1-config(.functions), business(.functions), deposit-amount, logo, error-page | ok |
| `painel.relatorio` | report-metrics, business, format | verificar |
| `painel.templates` | niche-assets, business | ok (US1) |
| `painel.as-pay` (Ag Pay dono) | agpay-support.functions, ledger.functions, pix-approvals.functions, withdrawal.functions, services.functions, deposit-amount, pix-key-format, format, format-phone, use-animated-modal, business | rebrand (US5) + US7/US9 |
| `painel.recebiveis` | lifecycle.functions, master.functions | rebrand (US5) |
| `painel.carteira-config` | agpay-fees.functions, master.functions | rebrand (US5) |
| `painel.carteira-desempenho` | agpay-performance.functions, master.functions | rebrand + rota→`agpay-performance` (US5/T030) |
| `painel.transacoes` | master.functions, transactions.functions | verificar |
| `painel.pix-aprovacao` | pix-approvals.functions, withdrawal.functions, master.functions, format-phone, pix-key-format | verificar |
| **Master** | | |
| `painel.master` | admin.functions, master.functions, master/platform-overview.functions, trial-store, error-page, format | verificar |
| `painel.negocios` | business(.functions), business, error-page, format | verificar |
| `painel.assinantes` | lifecycle.functions, master.functions, format | verificar |
| `painel.em-teste` | admin.functions, lifecycle.functions, master.functions, error-page | verificar |
| `painel.precisa-de-atencao` | admin.functions, lifecycle.functions, master.functions, subscription-lifecycle, format | verificar |
| `painel.equipe-geral` | master.functions, sdr.functions, format | verificar |
| `painel.notificacoes-alertas` | broadcasts.functions, master.functions | ok (US3 usa broadcasts) |
| `painel.suporte` | agpay-support.functions, master.functions | verificar |

## Conclusão (Foundational)

- **0 módulos ausentes** entre os 36 referenciados. A paridade de backend (US8) está satisfeita em nível de import; a Phase 10 exercita a ação principal de cada tela com dados reais (`verificar`).
- Telas financeiras (`as-pay`, `recebiveis`, `carteira-*`) concentram o cruzamento US5 (rebrand) × US7/US9 (pagamento/split) — coordenar edições para evitar conflito (ver tasks.md "Dependencies").
