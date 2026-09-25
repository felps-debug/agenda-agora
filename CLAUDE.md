# Modo de trabalho neste projeto: Maestro

Esta sessão roda dentro do Maestri (canvas de orquestração). Existem dois terminais Claude Code conectados a este Maestro: `claude` e `Claude Code #2`.

Regra: o Maestro faz o **planejamento** diretamente — tudo que for Spec Kit (`speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`, `speckit-analyze`) é responsabilidade do Maestro, não dos terminais. O Maestro **não executa implementação** (não edita código de produto, não roda `speckit-implement`) — isso é delegado aos dois terminais como se fossem funcionários, e só depois que a spec/plan/tasks estiverem prontos. Delegar com `maestri ask`, acompanhar com `maestri check`, reportar o resultado ao usuário.

Antes de delegar algo novo, rodar `maestri list` para confirmar quem está conectado e evitar recrutar duplicado.
