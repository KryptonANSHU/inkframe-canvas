import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { test, type Page } from '@playwright/test';
import type { BenchApi, FileTimes, FrameStats, Stats } from './types';

/** Frame times, hit-test latency, and file times at each size; memory at 5k. */
const SIZES = [1000, 5000, 10_000] as const;
const ANIMATION_FRAMES = 240;
const DRAG_SHAPES = 50;
const HIT_TEST_BATCHES = 50;
const MEMORY_SHAPES = 5000;
const MEMORY_MINUTES = Number(process.env['BENCH_MEMORY_MINUTES'] ?? '5');
const LABEL = process.env['BENCH_LABEL'] ?? 'run';

type SizeResult = {
  shapes: number;
  load: { buildMs: number; firstFrameMs: number };
  pan: FrameStats;
  zoom: FrameStats;
  pan100: FrameStats;
  drag: FrameStats;
  hitTestMicros: Stats;
  files: FileTimes;
};

declare global {
  interface Window {
    __inkframeBench: BenchApi;
  }
}

async function measureSize(page: Page, shapes: number): Promise<SizeResult> {
  const load = await page.evaluate((n) => window.__inkframeBench.load(n), shapes);
  const pan = await page.evaluate(
    (f) => window.__inkframeBench.animate('pan', f),
    ANIMATION_FRAMES,
  );
  const zoom = await page.evaluate(
    (f) => window.__inkframeBench.animate('zoom', f),
    ANIMATION_FRAMES,
  );
  const pan100 = await page.evaluate(
    (f) => window.__inkframeBench.animate('pan100', f),
    ANIMATION_FRAMES,
  );
  const drag = await page.evaluate(([n, f]) => window.__inkframeBench.drag(n, f), [
    DRAG_SHAPES,
    ANIMATION_FRAMES,
  ] as const);
  const hitTestMicros = await page.evaluate(
    (b) => window.__inkframeBench.hitTestMicros(b),
    HIT_TEST_BATCHES,
  );
  const files = await page.evaluate(() => window.__inkframeBench.fileTimes());
  return { shapes, load, pan, zoom, pan100, drag, hitTestMicros, files };
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const fps = (interval: Stats) => (interval.median > 0 ? round(1000 / interval.median, 0) : 0);
const frames = (stats: FrameStats) =>
  `${String(round(stats.drawMs.median))} / ${String(round(stats.drawMs.p95))} ms · ${String(fps(stats.intervalMs))} fps`;

function markdown(results: {
  date: string;
  label: string;
  machine: string;
  browser: string;
  gpu: string;
  sizes: SizeResult[];
  memory: {
    shapes: number;
    minutes: number;
    heapBeforeMB: number;
    heapAfterMB: number;
    edits: number;
  };
}): string {
  const rows = results.sizes.map(
    (size) =>
      `| ${size.shapes.toLocaleString('en')} | ${String(round(size.load.firstFrameMs))} ms | ${frames(size.pan)} | ${frames(size.zoom)} | ${frames(size.pan100)} | ${frames(size.drag)} | ${String(round(size.hitTestMicros.median))} / ${String(round(size.hitTestMicros.p95))} µs | ${String(round(size.files.saveMs))} ms | ${String(round(size.files.openMs))} ms | ${String(round(size.files.pngMs))} ms | ${String(round(size.files.svgMs))} ms |`,
  );
  const { memory } = results;
  return [
    `# Benchmark: ${results.label} (${results.date})`,
    '',
    `- Machine: ${results.machine}`,
    `- Browser: ${results.browser}, 1440 × 900 at DPR 2`,
    `- GPU: ${results.gpu}`,
    '- Pan, zoom, and drag have every shape on screen (zoomed to fit), the worst case for drawing; pan at 100% shows part of the drawing, as in normal use.',
    '- Frame columns: draw time median / p95, then frames per second from the median frame interval.',
    '',
    '| Shapes | First frame | Pan | Zoom | Pan at 100% | Drag 50 shapes | Hit test median / p95 | Save | Open | Export PNG | Export SVG |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Memory after a ${String(memory.minutes)}-minute editing session at ${memory.shapes.toLocaleString('en')} shapes (${memory.edits.toLocaleString('en')} edits): ${String(round(memory.heapBeforeMB))} MB → ${String(round(memory.heapAfterMB))} MB of JS heap.`,
    '',
  ].join('\n');
}

test('benchmark', async ({ page, browser }) => {
  await page.goto('/?bench');
  await page.waitForFunction(() => '__inkframeBench' in window);
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info === null || info === undefined || gl === null
      ? 'unknown'
      : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  });

  const sizes: SizeResult[] = [];
  for (const shapes of SIZES) {
    sizes.push(await measureSize(page, shapes));
  }

  // A fresh page for the memory session, so earlier sizes don't count.
  await page.reload();
  await page.waitForFunction(() => '__inkframeBench' in window);
  await page.evaluate((n) => window.__inkframeBench.load(n), MEMORY_SHAPES);
  const session = await page.evaluate((m) => window.__inkframeBench.editSession(m), MEMORY_MINUTES);

  const cpu = cpus()[0]?.model ?? 'unknown CPU';
  const results = {
    date: new Date().toISOString().slice(0, 10),
    label: LABEL,
    machine: `${cpu}, ${String(cpus().length)} cores, ${String(Math.round(totalmem() / 2 ** 30))} GB, ${platform()} ${release()}`,
    browser: `Chromium ${browser.version()}`,
    gpu,
    sizes,
    memory: { shapes: MEMORY_SHAPES, minutes: MEMORY_MINUTES, ...session },
  };
  const directory = new URL('./results/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const name = `${results.date}-${LABEL}`;
  await writeFile(new URL(`${name}.json`, directory), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(new URL(`${name}.md`, directory), markdown(results));
  // eslint-disable-next-line no-console -- the runner's whole output is this summary
  console.log(markdown(results));
});
