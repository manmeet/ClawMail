import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];
const pass = (name, ok, details = '') => results.push({ name, ok, details });

try {
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForSelector('.threadTable .mailRow');

  const drawerInitiallyHidden = !(await page.locator('.drawer.open').isVisible().catch(() => false));
  pass('Drawer hidden by default', drawerInitiallyHidden);

  await page.getByRole('button', { name: 'toggle folders' }).click();
  await page.waitForTimeout(120);
  pass('Drawer opens from rail', await page.locator('.drawer.open').isVisible());

  await page.getByRole('button', { name: 'close folders' }).click();
  await page.waitForTimeout(120);
  const drawerClosedByScrim = (await page.locator('.drawer.open').count()) === 0;
  pass('Drawer closes on scrim click', drawerClosedByScrim);

  await page.locator('.threadTable .mailRow').nth(1).click();
  await page.waitForTimeout(150);
  pass('Click thread opens full reader', await page.locator('.threadReader').isVisible());

  await page.getByRole('button', { name: 'back to list' }).click();
  await page.waitForTimeout(120);
  const returnedToList = (await page.locator('.threadReader').count()) === 0;
  pass('Back closes full reader', returnedToList);

  await page.locator('.threadTable .mailRow').first().click();
  await page.waitForTimeout(120);
  await page.keyboard.press('a');
  await page.waitForTimeout(60);
  const focused = await page.evaluate(() => document.activeElement?.matches('.chatComposer textarea') ?? false);
  pass('Focus chat with a', focused);

  await page.locator('.chatComposer textarea').fill('summarize this thread and next action');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(450);
  pass('Chat response appears', (await page.locator('.chatMsg.assistant').count()) > 0);

  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.scrollY);
  pass('Window scroll locked', before === after, `before=${before}, after=${after}`);

  await page.screenshot({ path: '/Users/manmeetmaggu/ClawMail/ui-check-final.png', fullPage: true });
} catch (err) {
  pass('Runtime error', false, String(err));
}

await browser.close();

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
}

if (results.some((r) => !r.ok)) process.exit(1);
