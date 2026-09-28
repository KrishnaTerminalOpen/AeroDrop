const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('[Puppeteer] Page Error:', err.toString());
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[Puppeteer] Console Error:', msg.text());
    }
  });

  await page.goto('http://localhost:3000/#chat-new', { waitUntil: 'networkidle2' });
  console.log('[Puppeteer] Navigation complete. Waiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
