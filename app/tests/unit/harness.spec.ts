import { expect, test } from '@playwright/test';
import { loadFixtures, orgId, user } from '../helpers/fixtures';

// QA-01 harness check (not a test case): the fixtures loader exposes every placeholder.
test('harness: fixtures loader exposes the placeholders @harness', async () => {
  const f = loadFixtures();
  for (const k of ['ORG-0', 'ORG-1', 'ORG-50', 'ORG-51', 'ORG-B']) expect(orgId(k), k).toBeTruthy();
  for (const k of ['U-0', 'U-1', 'U-50', 'U-51', 'U-B']) expect(user(k).email, k).toContain('@');
  for (const k of ['Q-MULTI', 'Q-REV', 'Q-B1', 'Q-NOLINES']) expect(f.quotes[k]?.id, k).toBeTruthy();
});
