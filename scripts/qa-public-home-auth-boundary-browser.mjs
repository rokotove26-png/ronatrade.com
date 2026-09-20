import { chromium } from 'playwright';

const protectedPaths = new Set([
  '/portal/admin',
  '/portal/select',
  '/portal/staff',
  '/portal/agent',
  '/portal/client',
]);

function isProtected(url) {
  try { return protectedPaths.has(new URL(url).pathname); }
  catch { return false; }
}

async function proveFixture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const protectedRequests = [];

  await page.route('**/portal/**', async route => {
    const url = route.request().url();
    if (isProtected(url)) protectedRequests.push(url);
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>protected</title><h1>PROTECTED</h1>',
    });
  });

  await page.setContent(`<!doctype html>
    <html><body>
      <section id="login">
        <h2>Личный кабинет</h2>
        <form>
          <input name="login" type="text">
          <input name="password" type="password">
          <button type="submit">Войти</button>
        </form>
      </section>
    </body></html>`);

  await page.addScriptTag({ path: 'assets/g82/portal-home-inline-auth-v2.js' });
  await page.waitForTimeout(1500);

  if (protectedRequests.length) {
    throw new Error('PUBLIC_HOME_AUTO_PROTECTED_REQUEST ' + JSON.stringify(protectedRequests));
  }
  if (isProtected(page.url())) {
    throw new Error('PUBLIC_HOME_AUTO_PROTECTED_NAVIGATION ' + page.url());
  }

  const loginValue = await page.locator('input[name="login"]').inputValue();
  const passwordValue = await page.locator('input[name="password"]').inputValue();
  if (loginValue || passwordValue) throw new Error('PUBLIC_HOME_CREDENTIAL_FIELDS_MUTATED');

  await context.close();
  await browser.close();
  console.log('PUBLIC_HOME_LOCAL_BROWSER_AUTH_BOUNDARY=PASS');
}

async function proveLive(origin) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Deliberately place portal-path cookies in the browser. They are fake and cannot
  // authenticate, but any public-page auto-probe of /portal/admin would still send them
  // and is itself a security-boundary violation.
  await context.addCookies([
    { name: 'rona_portal_at', value: 'security-boundary-sentinel-at', url: origin + '/portal/admin' },
    { name: 'rona_portal_rt', value: 'security-boundary-sentinel-rt', url: origin + '/portal/admin' },
  ]);

  const page = await context.newPage();
  const protectedRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (isProtected(url)) protectedRequests.push({ url, method: req.method(), resourceType: req.resourceType() });
  });

  await page.goto(origin + '/?_public_auth_boundary=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  const finalUrl = page.url();
  if (isProtected(finalUrl) || new URL(finalUrl).pathname.startsWith('/portal/')) {
    throw new Error('LIVE_PUBLIC_HOME_AUTO_PROTECTED_NAVIGATION ' + finalUrl);
  }
  if (protectedRequests.length) {
    throw new Error('LIVE_PUBLIC_HOME_AUTO_PROTECTED_REQUEST ' + JSON.stringify(protectedRequests));
  }

  console.log(JSON.stringify({
    ok: true,
    invariant: 'PUBLIC_HOME_NEVER_AUTO_ENTERS_PROTECTED_PORTAL',
    finalUrl,
    protectedRequestCount: protectedRequests.length,
  }));

  await context.close();
  await browser.close();
}

await proveFixture();
if (process.env.TARGET_ORIGIN) {
  await proveLive(process.env.TARGET_ORIGIN.replace(/\/$/, ''));
}
