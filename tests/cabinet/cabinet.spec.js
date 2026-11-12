import { readFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cabinetRoot, cabinetSha, candidateCatalog, origin } from '../../scripts/cabinet.mjs';

const candidate = `${origin}/mona-patrol/`;
const SIBLING_STUB = '<!doctype html><title>Sibling stub</title><p>Sibling game stub</p>';

const test = base.extend({
  page: async ({ page }, use) => {
    const failures = [];
    const failed = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failed.push(request));

    await page.route('https://jdooley-clt.github.io/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: SIBLING_STUB }),
    );
    await page.route('https://github.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: SIBLING_STUB }),
    );

    await use(page);

    for (const request of failed) {
      const reason = request.failure()?.errorText;
      if (['net::ERR_ABORTED', 'cancelled'].includes(reason)) continue;
      failures.push(`${reason} ${request.url()}`);
    }
    expect(failures, 'No uncaught errors, CSP/console errors, or failed requests').toEqual([]);
  },
});

const card = (page) => page.getByRole('button', { name: 'Play Mona Patrol', exact: true });
const stageData = (ctx, key) => ctx.locator('#stage').getAttribute(`data-${key}`);

async function readyEmbeddedGame(page) {
  const iframe = page.locator('#frame-host iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute('src', candidate);
  await expect
    .poll(() => page.frames().find((f) => f.url() === candidate)?.url())
    .toBe(candidate);
  const frame = page.frames().find((f) => f.url() === candidate);
  await expect.poll(() => stageData(frame, 'status'), { timeout: 30_000 }).toBe('ready');
  await expect(frame.locator('#arcade-link')).toBeHidden();
  await expect(frame.locator('#source-link')).toBeHidden();
  await expect(frame.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false');
  return frame;
}

test.beforeEach(async ({ page, request }) => {
  expect(await (await request.get('/health')).json()).toEqual({ cabinetSha });
  const served = await request.get(candidate);
  expect(served.ok()).toBeTruthy();
  expect(await served.text()).toBe(await readFile('_site/index.html', 'utf8'));
  await page.goto('/arcade/');
  await expect(card(page)).toBeVisible();
});

test('serves pinned cabinet intact and renders both Mona Patrol cover layers', async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, 'Catalog and artwork assertion runs once on desktop.');
  const original = JSON.parse(await readFile(`${cabinetRoot}/games.json`, 'utf8'));
  expect(await (await request.get('/arcade/games.json')).json()).toEqual(candidateCatalog(original));
  for (const file of ['index.html', 'styles.css', 'src/app.js', 'src/catalog.js']) {
    expect(await (await request.get(`/arcade/${file}`)).text()).toBe(
      await readFile(`${cabinetRoot}/${file}`, 'utf8'),
    );
  }

  const cardImgs = card(page).locator('img');
  await expect(cardImgs).toHaveCount(2);
  const cardLoaded = await cardImgs.evaluateAll((imgs) =>
    imgs.every((img) => img.complete && img.naturalWidth > 0),
  );
  expect(cardLoaded).toBe(true);

  // Catalog now has 6 games, so cabinet search appears and finds Mona Patrol
  const searchInput = page.locator('#game-search');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('lunar');
  await expect(card(page)).toBeVisible();
  await searchInput.fill('');

  await card(page).click();
  await readyEmbeddedGame(page);
  const headerImgs = page.locator('#game-cover img');
  await expect(headerImgs).toHaveCount(2);
  const headerLoaded = await headerImgs.evaluateAll((imgs) =>
    imgs.every((img) => img.complete && img.naturalWidth > 0),
  );
  expect(headerLoaded).toBe(true);

  for (const selector of ['#instruction-content .game-repo', '#player-guide .game-repo']) {
    const repoLink = page.locator(selector);
    await expect(repoLink).toHaveCount(1);
    await expect(repoLink).toHaveText('Source & credits ↗');
    await expect(repoLink).toHaveAttribute('href', 'https://github.com/jdooley-clt/mona-patrol');
    await expect(repoLink).toHaveAttribute('target', '_blank');
    await expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('#instruction-content .game-repo')).toBeVisible();
  await page.locator('#guide-toggle').click();
  await expect(page.locator('#player-guide .game-repo')).toBeVisible();
});

test('standalone page links have >=44px touch targets, preserve keyboard nav, and pass axe-core across states', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Standalone keyboard and axe checks run on desktop.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(candidate);
  await expect.poll(() => stageData(page, 'status')).toBe('ready');

  const arcadeLink = page.getByRole('link', { name: 'GitHub Arcade', exact: true });
  const sourceLink = page.getByRole('link', { name: 'Source & credits', exact: true });
  for (const [link, href] of [
    [arcadeLink, 'https://jdooley-clt.github.io/arcade/'],
    [sourceLink, 'https://github.com/jdooley-clt/mona-patrol'],
  ]) {
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', href);
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  // Stage picker previews F–J, K–O, P–T, U–Z backgrounds cleanly and returns to A–E
  await page.locator('[data-sector-pick="1"]').click();
  await expect.poll(() => stageData(page, 'checkpoint')).toBe('F');
  await page.locator('[data-sector-pick="2"]').click();
  await expect.poll(() => stageData(page, 'checkpoint')).toBe('K');
  await page.locator('[data-sector-pick="3"]').click();
  await expect.poll(() => stageData(page, 'checkpoint')).toBe('P');
  await page.locator('[data-sector-pick="0"]').click();
  await expect.poll(() => stageData(page, 'checkpoint')).toBe('A');

  // axe-core scan in ready (light mode)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Start with Enter, verify focus moves to #stage and ARIA live announcement fires
  await page.keyboard.press('Enter');
  await expect.poll(() => stageData(page, 'status')).toBe('playing');
  await expect(page.locator('#stage')).toBeFocused();
  await expect(page.locator('#announcer')).toContainText('Patrol started');
  // Keep road clear during multi-second axe-core DOM scans so runner speed never alters state
  await page.evaluate(() => {
    const st = window.__monaPatrol.getState();
    st.course.obstacles = [];
    st.course.waves = [];
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Focus standalone Arcade link — game keys must not hijack link focus
  await arcadeLink.focus();
  await expect(arcadeLink).toBeFocused();
  const gearBefore = await stageData(page, 'gear');
  const jumpsBefore = await stageData(page, 'jumps');
  const shotsBefore = await stageData(page, 'shots-fired');
  for (const key of ['ArrowRight', 'Space', 'p', 'm', 'z']) {
    await page.keyboard.press(key);
  }
  expect(await stageData(page, 'status')).not.toBe('paused');
  expect(await stageData(page, 'gear')).toBe(gearBefore);
  expect(await stageData(page, 'jumps')).toBe(jumpsBefore);
  expect(await stageData(page, 'shots-fired')).toBe(shotsBefore);
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false');

  // Toggle dark mode + help dialog + axe scan
  await page.locator('#theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#help').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await expect.poll(() => stageData(page, 'status')).toBe('paused');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect.poll(() => stageData(page, 'status')).toBe('playing');

  // Trigger blur -> auto-pauses + axe scan on paused overlay & Resume controls
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => stageData(page, 'status')).toBe('paused');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Resume, verify Stage A–E Clear stats screen + Replay A–E + axe scan
  await page.keyboard.press('Enter');
  await expect.poll(() => stageData(page, 'status')).toBe('playing');
  await page.evaluate(() => {
    const st = window.__monaPatrol.getState();
    st.course.obstacles = [];
    st.course.waves = [];
    st.sectionStats.ufosSpawned = 6;
    st.sectionStats.ufosDestroyed = 5;
    st.sectionStats.rocksDestroyed = 4;
    st.sectionStats.hazardsJumped = 3;
    st.sectionStats.shotsFired = 10;
    st.sectionStats.shotsHit = 8;
    st.buggy.worldX = st.course.length - 10;
    window.__monaPatrol.advance(250);
  });
  await expect.poll(() => stageData(page, 'status')).toBe('sector-clear');
  await expect(page.locator('#stats-grid')).toBeVisible();
  await expect(page.locator('#stat-ufos')).toHaveText('5 / 6');
  await expect(page.locator('#stat-rocks')).toHaveText('4');
  await expect(page.locator('#primary')).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.locator('#replay-sector').click();
  await expect.poll(() => stageData(page, 'status')).toBe('playing');
  await expect.poll(() => stageData(page, 'checkpoint')).toBe('A');

  // Verify game over focus management & axe scan
  await page.evaluate(() => {
    const st = window.__monaPatrol.getState();
    st.lives = 1;
    st.invulnTimer = 0;
    st.bombs.push({ x: st.buggy.worldX, y: st.buggy.y - 8, vx: 0, vy: 200, carvesCrater: false });
    window.__monaPatrol.advance(1100);
  });
  await expect.poll(() => stageData(page, 'status')).toBe('gameover');
  await expect(page.locator('#primary')).toBeFocused();
  await expect(page.locator('#announcer')).toContainText('Game over');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Standalone link navigation works via Enter
  await arcadeLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('https://jdooley-clt.github.io/arcade/');
});

for (const launch of ['mouse', 'keyboard']) {
  test(`${launch} launch in cabinet: Space, speed, jump, fire, pause, mute, focus mode, reload, and return work`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop keyboard launch coverage.');
    await page.setViewportSize({ width: 1440, height: 900 });
    if (launch === 'mouse') {
      await card(page).click();
    } else {
      await card(page).focus();
      await page.keyboard.press('Enter');
    }

    let frame = await readyEmbeddedGame(page);
    await expect(page.locator('#frame-host iframe')).toBeFocused();

    // Space starts immediately without scrolling cabinet or game frame
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.keyboard.press('Space');
    await expect.poll(() => stageData(frame, 'status')).toBe('playing');
    expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
    expect(await frame.evaluate(() => scrollY)).toBe(0);

    // Speed up & slow down
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => stageData(frame, 'gear')).toBe('fast');
    await page.keyboard.press('a');
    await expect.poll(() => stageData(frame, 'gear')).toBe('cruise');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => stageData(frame, 'gear')).toBe('slow');
    await page.keyboard.press('d');
    await expect.poll(() => stageData(frame, 'gear')).toBe('cruise');

    // Jump & fire
    await page.keyboard.press('Space');
    await expect.poll(async () => Number(await stageData(frame, 'jumps'))).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('z');
    await expect
      .poll(async () => Number(await stageData(frame, 'shots-fired')))
      .toBeGreaterThanOrEqual(1);

    // Pause freezes simulation timer; Space/P resumes
    await page.keyboard.press('p');
    await expect.poll(() => stageData(frame, 'status')).toBe('paused');
    const frozenElapsed = await stageData(frame, 'elapsed');
    await page.waitForTimeout(180);
    expect(await stageData(frame, 'elapsed')).toBe(frozenElapsed);
    await page.keyboard.press('p');
    await expect.poll(() => stageData(frame, 'status')).toBe('playing');

    // Audio starts off and toggles with M
    await expect(frame.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('m');
    await expect(frame.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('m');
    await expect(frame.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false');

    // Coexists with cabinet Focus mode and Fullscreen fallback
    const focusToggle = page.locator('#focus-button');
    await expect(focusToggle).toHaveAttribute('aria-pressed', 'false');
    await focusToggle.click();
    await expect(focusToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(frame.locator('#canvas')).toBeVisible();
    await focusToggle.click();
    await expect(focusToggle).toHaveAttribute('aria-pressed', 'false');

    const fullscreenBtn = page.locator('#fullscreen-button');
    await expect(fullscreenBtn).toBeVisible();
    await fullscreenBtn.click();
    await expect(frame.locator('#canvas')).toBeVisible();

    // Reload detaches old frame and re-focuses new frame
    await page.locator('#reload-game').click();
    await expect.poll(() => frame.isDetached()).toBe(true);
    frame = await readyEmbeddedGame(page);
    await page.keyboard.press('Space');
    await expect.poll(() => stageData(frame, 'status')).toBe('playing');

    // Return removes iframe and restores card focus
    await page.locator('#return-button').click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(card(page)).toBeFocused();
    expect(frame.isDetached()).toBe(true);
  });
}

test('switching to another game detaches the Mona Patrol iframe cleanly', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Lifecycle switch test runs once on desktop.');
  await card(page).click();
  const frame = await readyEmbeddedGame(page);
  await page.keyboard.press('Space');
  await expect.poll(() => stageData(frame, 'status')).toBe('playing');

  await page.goto('/arcade/#game/mona-maze');
  await expect(page.locator('#frame-host iframe')).toHaveCount(1);
  await expect.poll(() => frame.isDetached()).toBe(true);
  await page.goBack();
  await expect(page.locator('#frame-host iframe')).toHaveAttribute('src', candidate);
});

for (const width of [320, 390]) {
  test(`touch at ${width}px: zero overflow, un-clipped controls, and touch Faster/Slower/Jump/Fire work`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Touch coverage runs on mobile Chromium and mobile WebKit.');
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/arcade/#game/mona-patrol');
    const frame = await readyEmbeddedGame(page);

    for (const doc of [page, frame]) {
      const overflow = await doc.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `No horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    }

    await frame.locator('#primary').tap();
    await expect.poll(() => stageData(frame, 'status')).toBe('playing');

    await frame.locator('#btn-faster').scrollIntoViewIfNeeded();
    await frame.locator('#btn-faster').tap();
    await expect.poll(() => stageData(frame, 'gear')).toBe('fast');

    await frame.locator('#btn-slower').tap();
    await expect.poll(() => stageData(frame, 'gear')).toBe('cruise');

    await expect.poll(() => stageData(frame, 'status')).toBe('playing');
    await frame.locator('#btn-jump').tap();
    await expect.poll(async () => Number(await stageData(frame, 'jumps'))).toBeGreaterThanOrEqual(1);

    await expect.poll(() => stageData(frame, 'status')).toBe('playing');
    await frame.locator('#btn-fire').tap();
    await expect
      .poll(async () => Number(await stageData(frame, 'shots-fired')))
      .toBeGreaterThanOrEqual(1);

    // Clear remaining road hazards before pause & viewport geometry assertions so runner
    // timing jitter never enters `crashing` mid-tap.
    await frame.evaluate(() => {
      const st = window.__monaPatrol.getState();
      st.course.obstacles = [];
      st.bombs = [];
    });
    await expect.poll(() => stageData(frame, 'status')).toBe('playing');
    await frame.locator('#pause').scrollIntoViewIfNeeded();
    await frame.locator('#pause').tap();
    await expect.poll(() => stageData(frame, 'status')).toBe('paused');

    for (const id of [
      'theme',
      'audio-toggle',
      'help',
      'pause',
      'restart',
      'btn-slower',
      'btn-faster',
      'btn-jump',
      'btn-fire',
    ]) {
      const el = frame.locator(`#${id}`);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeInViewport();
      const rect = await el.evaluate((node) => {
        const b = node.getBoundingClientRect();
        return { left: b.left, right: b.right };
      });
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width + 1);
    }
  });
}

test('prefers-reduced-motion disables motion flags and remains fully playable', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Runs on desktop project.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card(page).click();
  const frame = await readyEmbeddedGame(page);
  expect(await stageData(frame, 'reduced-motion')).toBe('true');
  await page.keyboard.press('Space');
  await expect.poll(() => stageData(frame, 'status')).toBe('playing');
});
