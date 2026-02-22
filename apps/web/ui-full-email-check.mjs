import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
const results = [];
const pass = (name, ok, details = '') => results.push({ name, ok, details });
let mockedSendSeen = false;

try {
  await page.route('**/v1/mail/send', async (route, request) => {
    if (mockedSendSeen) {
      await route.continue();
      return;
    }
    mockedSendSeen = true;
    const payload = JSON.parse(request.postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'mock',
        item: { id: 'mock-send-1', threadId: payload.threadId }
      })
    });
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForSelector('.threadRow');

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(120);
  pass('Cmd/Ctrl+K opens command palette', await page.locator('.commandPalette').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  pass('Esc closes command palette', (await page.locator('.commandPalette').count()) === 0);

  pass('Right column is AI pane', await page.locator('.agentPane .agentHead h3').isVisible());

  await page.locator('button[aria-label=\"folders\"]').first().click();
  await page.waitForTimeout(120);
  pass('Drawer opens', await page.locator('.folderDrawer.open').isVisible());

  await page.locator('.folderDrawer .folderBtn').nth(1).click();
  await page.waitForTimeout(250);
  pass('Folder switch works', (await page.locator('.threadRow').count()) > 0);
  pass('Drawer auto-hides', (await page.locator('.folderDrawer.open').count()) === 0);

  const unreadBefore = await page.locator('.threadRow .dot.unread').count();
  const unreadRow = page.locator('.threadRow:has(.dot.unread)').first();
  const hasUnreadTarget = (await unreadRow.count()) > 0;
  const targetRow = hasUnreadTarget ? unreadRow : page.locator('.threadRow').first();

  await targetRow.click();
  await page.waitForTimeout(300);
  pass('Click opens thread workspace', await page.locator('.threadWorkspace').isVisible());
  pass('Reply dock hidden on open', (await page.locator('.threadWorkspace .replyDock').count()) === 0);

  const beforeMessageCount = await page.locator('.threadWorkspace .messageCard').count();
  await page.keyboard.press('r');
  await page.waitForTimeout(180);
  pass('r opens bottom reply dock', await page.locator('.threadWorkspace .replyDock').isVisible());

  const sentMarker = `ui-smoke-send-${Date.now()}`;
  await page.waitForFunction(() => {
    const el = document.querySelector('.threadWorkspace .replyDock textarea');
    return Boolean(el && (el instanceof HTMLTextAreaElement) && !el.disabled);
  });
  const replyArea = page.locator('.threadWorkspace .replyDock textarea').last();
  await replyArea.click();
  await replyArea.fill(`Reply body ${sentMarker}`);
  await page.locator('.threadWorkspace .replyDock .replyActions button:has-text("Send")').click();
  await page.waitForTimeout(420);
  pass('Send keeps thread open in reply mode', await page.locator('.threadWorkspace').isVisible());
  const afterMessageCount = await page.locator('.threadWorkspace .messageCard').count();
  pass('Sent reply appears in thread', afterMessageCount > beforeMessageCount, `${beforeMessageCount}->${afterMessageCount}`);
  pass('Sent reply body visible', await page.locator(`.threadWorkspace .messageBody:has-text("${sentMarker}")`).first().isVisible());

  await page.keyboard.press('r');
  await page.waitForTimeout(160);
  const wrapMode = await page.$eval('.messageBody', (el) => getComputedStyle(el).whiteSpace);
  pass('Thread body wraps', wrapMode.includes('pre-wrap'), `whiteSpace=${wrapMode}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  pass('Esc first press in reply blurs editor (dock remains)', (await page.locator('.threadWorkspace .replyDock').count()) === 1);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  pass('Esc second press closes reply dock', (await page.locator('.threadWorkspace .replyDock').count()) === 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  pass('Esc next press closes thread', (await page.locator('.threadWorkspace').count()) === 0);
  const unreadAfterClose = await page.locator('.threadRow .dot.unread').count();
  pass(
    'Click marks email as read',
    hasUnreadTarget ? unreadAfterClose < unreadBefore : true,
    hasUnreadTarget ? `unread ${unreadBefore}->${unreadAfterClose}` : 'skipped (no unread thread available)'
  );

  await page.keyboard.press('c');
  await page.waitForTimeout(150);
  pass('c opens floating composer', await page.locator('.replyDock.floating').isVisible());

  await page.locator('.replyDock.floating input[placeholder="To"]').fill('self.test@example.com');
  await page.locator('.replyDock.floating input[placeholder="Subject"]').fill('ClawMail superhuman style smoke');
  await page.locator('.replyDock.floating textarea').fill('This is a long line that should wrap correctly in composer and thread body rendering. '.repeat(5));

  await page.waitForTimeout(180);
  const statusBeforeDraft = await page.locator('.statusLine').textContent();
  await page.getByRole('button', { name: 'Save Draft' }).last().click();
  await page.waitForTimeout(450);
  const statusText = await page.locator('.statusLine').textContent();
  pass(
    'Save draft works',
    (statusText ?? '').toLowerCase().includes('draft') || (statusText ?? '') !== (statusBeforeDraft ?? ''),
    statusText ?? ''
  );

  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(120);
  pass('Close floating composer works', (await page.locator('.replyDock.floating').count()) === 0);

  await page.keyboard.press('/');
  await page.waitForTimeout(80);
  const searchFocused = await page.evaluate(() => document.activeElement?.matches('.listToolbar input') ?? false);
  pass('/ focuses search', searchFocused);

  const archiveTarget = page.locator('.threadRow').first();
  const archiveThreadId = await archiveTarget.getAttribute('data-thread-id');
  await archiveTarget.click();
  await page.waitForTimeout(280);
  await page.getByRole('button', { name: /Archive/ }).first().click();
  const archiveClosed = await page
    .waitForFunction(() => document.querySelectorAll('.threadWorkspace').length === 0, null, { timeout: 7000 })
    .then(() => true)
    .catch(() => false);
  pass('Archive button closes thread view', archiveClosed);
  if (archiveThreadId) {
    pass(
      'Archive removes thread from current list',
      (await page.locator(`.threadRow[data-thread-id="${archiveThreadId}"]`).count()) === 0
    );
  } else {
    pass('Archive removes thread from current list', true, 'skipped (missing thread id attr)');
  }

  const keyboardArchiveTarget = page.locator('.threadRow').first();
  const keyboardArchiveThreadId = await keyboardArchiveTarget.getAttribute('data-thread-id');
  await page.locator('.centerHeader h1').click();
  await page.keyboard.press('e');
  if (keyboardArchiveThreadId) {
    await page
      .waitForFunction((id) => !document.querySelector(`.threadRow[data-thread-id="${id}"]`), keyboardArchiveThreadId, { timeout: 7000 })
      .catch(() => {});
  }
  if (keyboardArchiveThreadId) {
    pass(
      'Keyboard e removes thread from current list',
      (await page.locator(`.threadRow[data-thread-id="${keyboardArchiveThreadId}"]`).count()) === 0
    );
  } else {
    pass('Keyboard e removes thread from current list', true, 'skipped (missing thread id attr)');
  }

  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.scrollY);
  pass('Window scroll locked', before === after, `before=${before}, after=${after}`);

  await page.screenshot({ path: '/Users/manmeetmaggu/ClawMail/ui-full-email-check.png', fullPage: true });
} catch (err) {
  pass('Runtime error', false, String(err));
}

await browser.close();
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
}
if (results.some((r) => !r.ok)) process.exit(1);
