-- Spec 005 (FR-010, SC-006): o histórico financeiro nunca é removido. Com ON DELETE
-- CASCADE, excluir um negócio tentaria apagar seus lançamentos e falharia de forma
-- obscura no trigger de imutabilidade; RESTRICT deixa a regra explícita — um negócio
-- com lançamentos no ledger não pode ser excluído.

ALTER TABLE public.ledger_entries
  DROP CONSTRAINT ledger_entries_business_id_fkey,
  ADD CONSTRAINT ledger_entries_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

-- Rollback:
-- ALTER TABLE public.ledger_entries
--   DROP CONSTRAINT ledger_entries_business_id_fkey,
--   ADD CONSTRAINT ledger_entries_business_id_fkey
--     FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
