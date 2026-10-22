import { expect, test } from '@playwright/test';
import { loginAs, json } from '../helpers/api';
import { anonymous } from '../helpers/api';

// QA-01 harness check (not a test case).
test('harness: backend is reachable and a seeded user can log in @harness', async () => {
  expect((await (await anonymous()).get('/api/health')).status()).toBe(200);
  const me = await json(await (await loginAs('U-51')).get('/api/me'));
  expect(me.user.email).toBeTruthy();
});
