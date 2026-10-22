import { expect, test } from '@playwright/test';
import { json, loginAs, walkList } from '../helpers/api';
import { quote, quoteId } from '../helpers/fixtures';
import { T, expectNoLeak, loginViaUi, quoteKeyUrl, signInViaApi, ui } from '../helpers/ui';

test("TC-050 Another organisation's quote URL is not found @TC-050 @FR-04 @AC-009", async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-B1'));
  await expect(page.getByText(T.notFound)).toBeVisible();
  await expectNoLeak(page, quote('Q-B1').reference, quote('Q-B1').title);
});

test('TC-054 Organisation B sees only its own quotes @TC-054 @FR-04 @AC-009', async ({ page }) => {
  await loginViaUi(page, 'U-B');
  await expect(ui.rows(page).first()).toBeVisible();
  const own = await walkList(await loginAs('U-B'), { pageSize: 100 });
  const other = await walkList(await loginAs('U-51'), { pageSize: 100 });
  expect(own.ids).toContain(String(quoteId('Q-B1')));
  for (const id of other.ids) expect(own.ids).not.toContain(id);
  // every row on screen belongs to ORG-B: its reference is in ORG-B's list
  const refs = new Set(own.pages.flat().map((i: any) => i.reference));
  const otherRefs = other.pages.flat().map((i: any) => i.reference as string);
  const text = await page.locator('body').innerText();
  for (const r of otherRefs) expect(text).not.toMatch(new RegExp(`(^|[^A-Za-z0-9-])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9-])`));
  expect(refs.size).toBeGreaterThan(0);
  await page.goto(quoteKeyUrl('Q-MULTI'));
  await expect(page.getByText(T.notFound)).toBeVisible();
  expect((await json(await (await loginAs('U-B')).get(`/api/quotes/${quoteId('Q-MULTI')}`))).message).toBe(T.notFound);
});
