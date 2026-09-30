-- Normaliza serviços legados que exigem sinal, mas cujo sinal efetivo é zero.
-- O cliente público confirma esses agendamentos sem pagamento.
UPDATE public.services
SET requires_deposit = false
WHERE requires_deposit IS TRUE
  AND (
    (deposit_mode = 'fixed' AND deposit_cents = 0)
    OR (
      deposit_mode = 'percent'
      AND round(price_cents::numeric * deposit_percent_bps / 10000) = 0
    )
  );

-- Rollback (manual): esta normalização não é reversível sem distinguir serviços
-- originalmente configurados sem sinal. Restaure requires_deposit dos IDs afetados
-- a partir de um snapshot anterior à migração; não defina true para todos os serviços
-- com sinal efetivo zero, pois isso alteraria configurações intencionais.
-- Exemplo, se o snapshot estiver em uma tabela temporária com service_id e
-- requires_deposit originais:
-- UPDATE public.services AS service
-- SET requires_deposit = snapshot.requires_deposit
-- FROM services_zero_deposit_snapshot AS snapshot
-- WHERE service.id = snapshot.service_id;
