import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';
import path from 'path';

const outDir = 'C:\\Users\\Admin\\.gemini\\antigravity/brain/badd1f15-ab54-45ab-b81a-d1025fffd039';
const JWT_SECRET = 'aerodrop_super_secret_jwt_key_2026';

const testUser = {
  id: 'u_0eac5eca-d97f-4113-bc0d-f09963a17cc2',
  email: 'aerodrop404@gmail.com',
  displayName: 'AeroDrop',
  initials: 'AD',
  color: '#db2777'
};

const token = jwt.sign(
  {
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    displayName: testUser.displayName
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Desktop Authenticated Header (1440px)
  await page.setViewport({ width: 1440, height: 800 });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((u, tok) => {
    localStorage.setItem('aerodrop_token', tok);
    localStorage.setItem('aerodrop_user', JSON.stringify(u));
  }, testUser, token);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));

  const headerEl = await page.$('header');
  if (headerEl) {
    await headerEl.screenshot({ path: path.join(outDir, 'header_desktop_auth.png') });
    console.log('Saved header_desktop_auth.png');
  }

  // Top viewport with page context (desktop auth)
  await page.screenshot({
    path: path.join(outDir, 'navbar_context_desktop_auth.png'),
    clip: { x: 0, y: 0, width: 1440, height: 350 }
  });
  console.log('Saved navbar_context_desktop_auth.png');

  // 2. Desktop Unauthenticated Header (1440px)
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const headerUnauthEl = await page.$('header');
  if (headerUnauthEl) {
    await headerUnauthEl.screenshot({ path: path.join(outDir, 'header_desktop_unauth.png') });
    console.log('Saved header_desktop_unauth.png');
  }

  await page.screenshot({
    path: path.join(outDir, 'navbar_context_desktop_unauth.png'),
    clip: { x: 0, y: 0, width: 1440, height: 350 }
  });
  console.log('Saved navbar_context_desktop_unauth.png');

  // 3. Mobile Authenticated Header & Bottom Nav (390px)
  await page.evaluate((u, tok) => {
    localStorage.setItem('aerodrop_token', tok);
    localStorage.setItem('aerodrop_user', JSON.stringify(u));
  }, testUser, token);

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));

  await page.screenshot({
    path: path.join(outDir, 'navbar_mobile_auth.png'),
    clip: { x: 0, y: 0, width: 390, height: 250 }
  });
  console.log('Saved navbar_mobile_auth.png');

  // 4. Mobile Unauthenticated Header (390px)
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(outDir, 'navbar_mobile_unauth.png'),
    clip: { x: 0, y: 0, width: 390, height: 250 }
  });
  console.log('Saved navbar_mobile_unauth.png');

  await browser.close();
}

run().catch(console.error);
