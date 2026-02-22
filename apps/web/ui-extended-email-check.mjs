import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
const results = [];
const pass = (name, ok, details = '') => results.push({ name, ok, details });

let sendMocked = false;

async function openFirstThread() {
  const id = await page.locator('.threadRow').first().getAttribute('data-thread-id');
  await page.locator('.threadRow').first().click();
  await page.waitForTimeout(240);
  return id;
}

async function waitThreadReady() {
  await page.waitForFunction(() => {
    const workspace = document.querySelector('.threadWorkspace');
    if (!workspace) return false;
    return !workspace.textContent?.includes('Loading thread');
  }, null, { timeout: 8000 });
}

try {
  await page.route('**/v1/mail/send', async (route, request) => {
    if (sendMocked) {
      await route.continue();
      return;
    }
    sendMocked = true;
    const payload = JSON.parse(request.postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ source: 'mock', item: { id: 'mock-send-extended', threadId: payload.threadId } })
    });
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForSelector('.threadRow');

  await page.locator('button[aria-label=\"folders\"]').first().click();
  await page.waitForTimeout(100);
  pass('Drawer opens from rail', await page.locator('.folderDrawer.open').isVisible());
  await page.locator('.scrim').click();
  await page.waitForTimeout(100);
  pass('Drawer closes via scrim click', (await page.locator('.folderDrawer.open').count()) === 0);

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const activeThreadId = await openFirstThread();
  await waitThreadReady();
  pass('Thread opens after closing command palette', await page.locator('.threadWorkspace').isVisible());

  await page.keyboard.press('r');
  const replyViaR = await page
    .waitForFunction(() => document.querySelectorAll('.threadWorkspace .replyDock').length > 0, null, { timeout: 2200 })
    .then(() => true)
    .catch(() => false);
  pass('r still works after closing command palette', replyViaR);
  if (!replyViaR) {
    await page.getByRole('button', { name: /Reply/ }).first().click();
    await page.waitForTimeout(160);
  }

  if ((await page.locator('.threadWorkspace .replyDock').count()) > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }

  if ((await page.locator('.threadWorkspace').count()) === 0) {
    await openFirstThread();
    await waitThreadReady();
  }

  await page.locator('.threadHeader h2').click();
  await page.waitForTimeout(420);
  await page.keyboard.press('a');
  await page.waitForTimeout(120);
  const replyViaA = await page.locator('.threadWorkspace .replyDock').isVisible();
  pass('a opens reply dock (reply all intent)', replyViaA);
  if (!replyViaA) {
    await page.getByRole('button', { name: /Reply/ }).first().click();
    await page.waitForTimeout(160);
  }

  const marker = `extended-send-${Date.now()}`;
  if ((await page.locator('.threadWorkspace .replyDock').count()) > 0) {
    await page.locator('.threadWorkspace .replyDock textarea').fill(`Extended send ${marker}`);
    await page.keyboard.press('Control+Enter');
    const sentViaShortcut = await page
      .waitForFunction((m) => {
        const hasBody = document.querySelector(`.threadWorkspace .messageBody`)?.textContent?.includes(m) ?? false;
        const hasStatus = (document.querySelector('.statusLine')?.textContent ?? '').toLowerCase().includes('message sent');
        const dockClosed = document.querySelectorAll('.threadWorkspace .replyDock').length === 0;
        return hasBody || hasStatus || dockClosed;
      }, marker, { timeout: 4500 })
      .then(() => true)
      .catch(() => false);
    pass('Ctrl/Cmd+Enter sends reply', sentViaShortcut);
    if (!sentViaShortcut) {
      await page.locator('.threadWorkspace .replyDock .replyActions button:has-text("Send")').first().click();
      await page.waitForTimeout(260);
    }
  } else {
    pass('Ctrl/Cmd+Enter sends reply', false, 'reply dock did not open');
  }

  if ((await page.locator('.threadWorkspace').count()) === 0 && activeThreadId) {
    await page.locator(`.threadRow[data-thread-id=\"${activeThreadId}\"]`).first().click();
    await page.waitForTimeout(240);
  }

  await page.getByRole('button', { name: /Unread/ }).first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press('u');
  await page.waitForTimeout(220);

  if (activeThreadId) {
    let unreadMarked = (await page.locator(`.threadRow[data-thread-id="${activeThreadId}"] .dot.unread`).count()) === 1;
    if (!unreadMarked) {
      await page.locator(`.threadRow[data-thread-id="${activeThreadId}"]`).first().click();
      await page.waitForTimeout(220);
      await page.getByRole('button', { name: /Unread/ }).first().click();
      await page.waitForTimeout(240);
      await page.keyboard.press('u');
      await page.waitForTimeout(240);
      unreadMarked = (await page.locator(`.threadRow[data-thread-id="${activeThreadId}"] .dot.unread`).count()) === 1;
    }
    pass('Unread action marks row unread in list', unreadMarked);
  } else {
    pass('Unread action marks row unread in list', false, 'missing active thread id');
  }

  await openFirstThread();
  pass('Reply dock defaults hidden on reopen', (await page.locator('.threadWorkspace .replyDock').count()) === 0);
} catch (err) {
  pass('Runtime error', false, String(err));
}

await browser.close();
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
}
if (results.some((r) => !r.ok)) process.exit(1);
