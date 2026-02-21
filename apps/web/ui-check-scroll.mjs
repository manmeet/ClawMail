import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 560 } });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForSelector('.threadTable .mailRow');

const winBefore = await page.evaluate(() => window.scrollY);
await page.mouse.move(720, 300);
await page.mouse.wheel(0, 2200);
await page.waitForTimeout(120);
const winAfter = await page.evaluate(() => window.scrollY);

const listBefore = await page.$eval('.threadTable', (el) => el.scrollTop);
await page.locator('.threadTable').hover();
await page.mouse.wheel(0, 1800);
await page.waitForTimeout(140);
const listAfter = await page.$eval('.threadTable', (el) => el.scrollTop);

console.log(`windowScroll:${winBefore}->${winAfter}`);
console.log(`listScroll:${listBefore}->${listAfter}`);

await page.screenshot({ path: '/Users/manmeetmaggu/ClawMail/ui-check-after-fix.png', fullPage: true });
await browser.close();

if (winAfter !== winBefore) process.exit(1);
if (listAfter <= listBefore) process.exit(2);
