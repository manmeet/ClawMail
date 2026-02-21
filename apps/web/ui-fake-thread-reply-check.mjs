import { chromium } from 'playwright';

const fakeThreadId = 'fake-thread-1';
const fakeMessages = [
  {
    id: 'm1',
    sender: 'founder@example.com',
    body: 'Initial inbound message for the fake thread.',
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    labelIds: ['INBOX', 'UNREAD']
  }
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
const results = [];
const pass = (name, ok, details = '') => results.push({ name, ok, details });

try {
  await page.route('**/v1/mail/threads?*', async (route) => {
    const url = new URL(route.request().url());
    const folder = url.searchParams.get('folder') ?? 'important';
    const items = folder === 'important' || folder === 'inbox'
      ? [
          {
            id: fakeThreadId,
            subject: 'Fake thread: confirm launch plan',
            participants: ['founder@example.com'],
            snippet: 'Can we confirm launch timing?',
            lastMessageAt: new Date(Date.now() - 60_000).toISOString(),
            unread: true,
            state: 'priority',
            priority: { score: 0.9, level: 'P1', reasons: ['Mock urgent'] }
          }
        ]
      : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ source: 'mock', items })
    });
  });

  await page.route(`**/v1/mail/threads/${fakeThreadId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'mock',
        item: {
          id: fakeThreadId,
          subject: 'Fake thread: confirm launch plan',
          participants: ['founder@example.com'],
          snippet: 'Can we confirm launch timing?',
          lastMessageAt: new Date(Date.now() - 60_000).toISOString(),
          unread: true,
          state: 'priority',
          priority: { score: 0.9, level: 'P1', reasons: ['Mock urgent'] },
          messages: fakeMessages
        }
      })
    });
  });

  await page.route(`**/v1/mail/threads/${fakeThreadId}/actions`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ source: 'mock', item: { ok: true } })
    });
  });

  await page.route('**/v1/mail/send', async (route, req) => {
    const payload = JSON.parse(req.postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ source: 'mock', item: { id: 'mock-send', threadId: payload.threadId ?? fakeThreadId } })
    });
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForSelector('.threadRow');

  await page.locator(`.threadRow[data-thread-id="${fakeThreadId}"]`).click();
  await page.waitForTimeout(220);
  pass('Fake thread opens', await page.locator('.threadWorkspace').isVisible());

  const beforeCount = await page.locator('.threadWorkspace .messageCard').count();
  await page.keyboard.press('r');
  await page.waitForTimeout(120);

  const marker = `fake-send-${Date.now()}`;
  await page.locator('.threadWorkspace .replyDock textarea').fill(`Reply from smoke test ${marker}`);
  await page.locator('.threadWorkspace .replyDock .replyActions button:has-text("Send")').click();
  await page.waitForTimeout(360);

  const afterCount = await page.locator('.threadWorkspace .messageCard').count();
  pass('Reply send appends a new message card', afterCount === beforeCount + 1, `${beforeCount}->${afterCount}`);
  pass('Reply text is visible in thread', await page.locator(`.threadWorkspace .messageBody:has-text("${marker}")`).first().isVisible());
  pass('Reply dock closes after send', (await page.locator('.threadWorkspace .replyDock').count()) === 0);
} catch (err) {
  pass('Runtime error', false, String(err));
}

await browser.close();
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
}
if (results.some((r) => !r.ok)) process.exit(1);
