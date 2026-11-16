export type MasterCoupon = { percent: number; expiresAt: string };

export function isMasterCouponActive(
  coupon: MasterCoupon | null | undefined,
  now = new Date(),
): coupon is MasterCoupon {
  return Boolean(
    coupon &&
    Number.isFinite(coupon.percent) &&
    coupon.percent > 0 &&
    Number.isFinite(new Date(coupon.expiresAt).getTime()) &&
    new Date(coupon.expiresAt) > now,
  );
}
