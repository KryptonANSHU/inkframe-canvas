import { expect, test, type Browser, type Page, type WebSocketRoute } from '@playwright/test';
import { canvas, drag, savedShapes, type SavedShape } from './helpers';

/**
 * Browser messages that are expected while a connection is deliberately cut: proof
 * the reconnect logic is retrying. Anything else in the console fails the test.
 */
const EXPECTED_WHILE_OFFLINE = [/WebSocket connection to .* failed/, /WebSocket is closed before/];

type Client = { readonly page: Page; readonly problems: string[] };

let clients: Client[] = [];

test.afterEach(async () => {
  for (const { page, problems } of clients) {
    expect(problems.filter((p) => !EXPECTED_WHILE_OFFLINE.some((ok) => ok.test(p)))).toEqual([]);
    await page.context().close();
  }
  clients = [];
});

const newRoom = () => `e2e${Math.random().toString(36).slice(2, 12)}`;

async function open(browser: Browser, path: string): Promise<Client> {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(path);
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  const client = { page, problems };
  clients.push(client);
  return client;
}

/** A client in `room`, connected. */
async function join(browser: Browser, room: string): Promise<Page> {
  const { page } = await open(browser, `/?room=${room}`);
  await expect(status(page)).toHaveText('Connected');
  await canvas(page).focus();
  return page;
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: /Connect|Offline/ });

async function drawRect(page: Page, x: number, y: number) {
  await canvas(page).focus();
  await page.keyboard.press('r');
  await drag(page, [x, y], [x + 80, y + 60]);
  await page.keyboard.press('Escape');
}

/** The drawing as each client would save it: positions and types, in draw order. */
async function drawing(page: Page): Promise<string> {
  const shapes = await savedShapes(page);
  return JSON.stringify(shapes.map((s: SavedShape) => [s.type, s.x, s.y]));
}

async function shapeCount(page: Page): Promise<number> {
  return (await savedShapes(page)).length;
}

test('four people drawing at once end up with the same drawing', async ({ browser }) => {
  const room = newRoom();
  const pages = await Promise.all([0, 1, 2, 3].map(() => join(browser, room)));
  await Promise.all(pages.map((page, i) => drawRect(page, 100 + i * 120, 200)));
  for (const page of pages) await expect.poll(() => shapeCount(page)).toBe(4);
  const [reference, ...rest] = await Promise.all(pages.map(drawing));
  for (const other of rest) expect(other).toBe(reference);

  const [first] = pages;
  if (first === undefined) throw new Error('No clients.');
  await first.getByRole('button', { name: 'Draw together' }).click();
  await expect(first.getByRole('heading', { name: 'In this room (4)' })).toBeVisible();
});

test('undo removes only your own work, for everyone', async ({ browser }) => {
  const room = newRoom();
  const [a, b] = await Promise.all([join(browser, room), join(browser, room)]);
  await drawRect(a, 100, 200);
  await expect.poll(() => shapeCount(b)).toBe(1);
  await drawRect(b, 400, 200);
  await expect.poll(() => shapeCount(a)).toBe(2);

  await a.keyboard.press('ControlOrMeta+Z');
  for (const page of [a, b]) {
    await expect.poll(async () => (await savedShapes(page)).map((s) => s.x)).toEqual([400]);
  }
  await expect(a.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(b.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await a.keyboard.press('ControlOrMeta+Shift+Z');
  await expect.poll(() => shapeCount(b)).toBe(2);
});

/** Cuts a page's connection to the relay until `reconnect` is called. */
async function cuttable(page: Page) {
  let cut = false;
  const routes: WebSocketRoute[] = [];
  await page.routeWebSocket(/localhost:1234/, (ws) => {
    if (cut) {
      void ws.close();
      return;
    }
    ws.connectToServer();
    routes.push(ws);
  });
  return {
    async disconnect() {
      cut = true;
      await page.context().setOffline(true);
      for (const route of routes.splice(0)) await route.close();
    },
    async reconnect() {
      cut = false;
      await page.context().setOffline(false);
    },
  };
}

test('edits made offline merge when the connection returns', async ({ browser }) => {
  const room = newRoom();
  const a = await join(browser, room);
  const { page: b } = await open(browser, '/');
  const network = await cuttable(b);
  await b.goto(`/?room=${room}`);
  await expect(status(b)).toHaveText('Connected');

  await network.disconnect();
  await expect(status(b)).toHaveText('Offline');
  await drawRect(b, 100, 200);
  await drawRect(a, 400, 200);
  expect(await shapeCount(a)).toBe(1);

  await network.reconnect();
  await expect(status(b)).toHaveText('Connected', { timeout: 10_000 });
  for (const page of [a, b]) await expect.poll(() => shapeCount(page)).toBe(2);
  expect(await drawing(a)).toBe(await drawing(b));
});

test('an arrow attached to a shape someone else deleted lets go, everywhere', async ({
  browser,
}) => {
  const room = newRoom();
  const a = await join(browser, room);
  const { page: b } = await open(browser, '/');
  const network = await cuttable(b);
  await b.goto(`/?room=${room}`);
  await expect(status(b)).toHaveText('Connected');
  await drawRect(a, 200, 200);
  await expect.poll(() => shapeCount(b)).toBe(1);

  // Offline, B attaches an arrow to the box's right edge while A deletes the box.
  await network.disconnect();
  await b.keyboard.press('a');
  await drag(b, [284, 231], [420, 231]);
  await b.keyboard.press('Escape');
  const attached = (await savedShapes(b)).find((shape) => shape.type === 'arrow');
  expect(attached).toMatchObject({ start: { anchor: 'right' } });
  await a.mouse.click(240, 200);
  await a.keyboard.press('Delete');

  await network.reconnect();
  for (const page of [a, b]) {
    await expect
      .poll(() => savedShapes(page))
      .toEqual([expect.objectContaining({ type: 'arrow' })]);
    const [arrow] = await savedShapes(page);
    expect(arrow?.start).toBeUndefined();
    // The dev invariants checker reports any broken rule as an error toast.
    await expect(page.getByText('Document invariants broken')).toHaveCount(0);
  }
});

test('starting a room shares this drawing; leaving brings your own back', async ({ browser }) => {
  const { page: a } = await open(browser, '/');
  await drawRect(a, 100, 200);
  await a.getByRole('button', { name: 'Draw together' }).click();
  await a.getByRole('button', { name: 'Start a room and copy link' }).click();
  await expect(status(a)).toHaveText('Connected');
  const link = await a.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(a.url());
  // Close the panel with its button (it hands focus back to the canvas).
  await a.getByRole('button', { name: 'Draw together' }).click();
  await expect(canvas(a)).toBeFocused();

  const b = await join(browser, new URL(link).searchParams.get('room') ?? '');
  await expect.poll(() => shapeCount(b)).toBe(1);
  await drawRect(b, 400, 200);
  await expect.poll(() => shapeCount(a)).toBe(2);

  await a.getByRole('button', { name: 'Draw together' }).click();
  await a.getByRole('button', { name: 'Leave room' }).click();
  await a.getByRole('button', { name: 'Draw together' }).click();
  await expect(status(a)).toHaveCount(0);
  expect(new URL(a.url()).searchParams.has('room')).toBe(false);
  await expect.poll(async () => (await savedShapes(a)).map((s) => s.x)).toEqual([100]);
});
