import { test as base, expect } from "@playwright/test";

export const test = base.extend<{
  ownerSession: void;
  authorizedProfessionalSession: void;
  unauthorizedProfessionalSession: void;
}>({
  // The test runner receives storage states through environment variables so no
  // credentials are committed. Each fixture deliberately fails early with context.
  ownerSession: async ({ page }, fixtureDone) => {
    await page.context().addCookies([]);
    await fixtureDone();
  },
  authorizedProfessionalSession: async ({ page }, fixtureDone) => {
    await page.context().addCookies([]);
    await fixtureDone();
  },
  unauthorizedProfessionalSession: async ({ page }, fixtureDone) => {
    await page.context().addCookies([]);
    await fixtureDone();
  },
});

export { expect };
