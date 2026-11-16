-- Subscription payment history is account-owner financial data.
DROP POLICY IF EXISTS subscription_payments_member_read ON public.subscription_payments;
DROP POLICY IF EXISTS subscription_payments_owner_read ON public.subscription_payments;

CREATE POLICY subscription_payments_owner_read ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (public.owns_business(business_id));