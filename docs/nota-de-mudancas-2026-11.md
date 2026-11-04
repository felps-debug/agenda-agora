# Atualização do Agenda Agora — novembro de 2026

Esta é uma versão local para revisão. Ainda não foi publicada nem conectada ao banco de produção.

## O que está sendo ajustado

- A área de pagamentos passa a aparecer como **Carteira**. Os valores de taxa ficam salvos na plataforma e deixam de depender do navegador do Master.
- O acesso de SDR e Master recebe limites para tentativas inválidas, PINs configurados no ambiente seguro e opção para gerar uma senha temporária quando um dono perde o acesso.
- A conclusão de um atendimento pode agendar uma mensagem de pós-atendimento no WhatsApp. A tela de Integrações também oferece uma mensagem de teste para um número informado.
- O ciclo de assinatura pode cancelar negócios inadimplentes a partir do dia 15. Essa opção nasce desligada; nenhum cancelamento automático será ativado sem decisão do Welison.
- A tela de pagamento permite configurar sinal fixo ou percentual. O valor mínimo precisa ser confirmado com a AgPay antes de liberar percentuais que possam gerar um sinal abaixo do piso do provedor.
- A agenda pública segue no layout Elegance e permite dias por serviço. Nenhum dia já salvo será alterado até revisar os dados e decidir a regra para negócios abertos no domingo.
- Ações antigas do Master sem tela em uso foram retiradas. O catálogo e o editor de artes que aparecem na área de modelos continuam disponíveis.

## O que continua pendente

- As telas do Master, SDR, AS Pay e WhatsApp ainda precisam de uma revisão de controles para separar funções operacionais de itens apenas visuais. A lista de revisão será compartilhada antes de pedir qualquer aprovação ao Guilherme.
- Depois dessa revisão, o Guilherme deve aprovar a lista concreta de controles que serão ocultados ou removidos. Não há uma lista final para aprovação nesta versão do documento.
- A consulta sobre serviços que podem atender aos domingos depende de leitura do banco de produção. Nenhum dia de atendimento existente será alterado até essa consulta e a decisão do Welison.
- A mensagem de teste do WhatsApp envia uma mensagem real para o número informado; use apenas um número autorizado durante a revisão.
- O reset de senha gera uma senha temporária exibida uma vez. O responsável deve entregá-la ao dono pelo canal combinado e orientar a troca depois do primeiro acesso.

## Situação

As mudanças estão na branch local `endurecimento-010`, ainda sem testes, build, QA de navegador, aplicação de migration, commit, push ou deploy. O inventário estático está pronto; a revisão visual e as validações em ambiente de ensaio continuam pendentes antes de revisar a publicação.
