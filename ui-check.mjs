import { chromium } from 'playwright';

const url = 'http://localhost:3001';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const results = [];

function log(name, ok, details = '') {
  results.push({ name, ok, details });
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.waitForSelector('.threadTable .mailRow');

  const folders = ['Inbox', 'Important', 'Waiting'];
  for (const folder of folders) {
    await page.getByRole('button', { name: folder, exact: true }).click();
    await page.waitForTimeout(150);
  }
  log('Folder clicks', true);

  await page.locator('.threadTable .mailRow').nth(1).click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const threadOpenVisible = await page.locator('.threadOpenPane').isVisible();
  log('Open thread with Enter', threadOpenVisible);

  await page.keyboard.press('u');
  await page.waitForTimeout(150);
  const threadClosed = (await page.locator('.threadOpenPane').count()) === 0 || !(await page.locator('.threadOpenPane').isVisible());
  log('Close thread with u', threadClosed);

  await page.keyboard.press('a');
  await page.waitForTimeout(80);
  const focusedIsComposer = await page.evaluate(() => {
    const active = document.activeElement;
    return !!active && active.matches('.chatComposer textarea');
  });
  log('Focus chat with a', focusedIsComposer);

  await page.locator('.chatComposer textarea').fill('summarize this thread and next action');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(500);
  const hasAssistantMessage = await page.locator('.chatMsg.assistant').count();
  log('Send chat message', hasAssistantMessage > 0, `assistant messages: ${hasAssistantMessage}`);

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 2200);
  await page.waitForTimeout(120);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  log('Window scroll locked', scrollAfter === scrollBefore, `before=${scrollBefore}, after=${scrollAfter}`);

  await page.screenshot({ path: '/Users/manmeetmaggu/ClawMail/ui-check-before-fix.png', fullPage: true });
} catch (e) {
  log('Runtime error', false, String(e));
}

await browser.close();

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
}

const failed = results.some((r) => !r.ok);
process.exit(failed ? 1 : 0);
