/** PROTOTYPE screenshot helper — throwaway, same as the #95 slice used. */
import { mkdir } from 'node:fs/promises';
import puppeteer from '../web-slice/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VARIANTS = ['A', 'B', 'C'];
const SCREENS = ['wardrobe', 'item', 'builder', 'stats'];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2 },
};

await mkdir(new URL('./screenshots/', import.meta.url), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  await page.setViewport(viewport);
  for (const variant of VARIANTS) {
    for (const screen of SCREENS) {
      await page.goto(`http://localhost:5174/?variant=${variant}&screen=${screen}`, {
        waitUntil: 'networkidle0',
      });
      await new Promise((resolve) => setTimeout(resolve, 1800));
      await page.screenshot({
        path: `./screenshots/${name}-${variant}-${screen}.jpg`,
        type: 'jpeg',
        quality: 72,
      });
      console.log(`${name}-${variant}-${screen}`);
    }
  }
}

await browser.close();
