import { fitBounds, panBy, screenToWorld, zoomAt } from '../src/core/camera';
import { executeCommand, updateShapesCommand } from '../src/core/commands';
import type { Editor } from '../src/core/dom/createEditor';
import { createExportClient } from '../src/core/dom/exportClient';
import { exportBounds } from '../src/core/export/exportArea';
import { EMPTY_HISTORY } from '../src/core/history';
import { hitTest } from '../src/core/hitTest';
import { documentFromShapes, toFile } from '../src/core/persistence/fileFormat';
import { readFileText } from '../src/core/persistence/readFile';
import type { Shape } from '../src/core/shapes';
import { benchScene, SCENE_HEIGHT, SCENE_WIDTH } from './scene';
import type { BenchApi, FrameStats, Stats } from './types';

const FIT_PADDING_PX = 32;
const HIT_TESTS_PER_BATCH = 100;

export function summarize(samples: readonly number[]): Stats {
  const sorted = samples.toSorted((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return { median: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0, count: sorted.length };
}

/**
 * Drives the real app for `npm run bench` (loaded only with ?bench): the same editor,
 * renderer, and React UI a user gets, with timings taken around them.
 */
export function attachBench(editor: Editor): void {
  const { store } = editor;
  const canvas = document.querySelector('canvas');
  if (canvas === null) throw new Error('No canvas to benchmark.');
  const view = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });

  const record = () => {
    const draws: number[] = [];
    const stamps: number[] = [];
    const stop = editor.onFrame((drawMs) => {
      draws.push(drawMs);
      stamps.push(performance.now());
    });
    return { draws, stamps, stop };
  };
  const frameStats = ({ draws, stamps }: { draws: number[]; stamps: number[] }): FrameStats => ({
    drawMs: summarize(draws),
    intervalMs: summarize(stamps.slice(1).map((stamp, i) => stamp - (stamps[i] ?? stamp))),
  });
  const nextFrame = () =>
    new Promise<void>((resolve) => {
      const stop = editor.onFrame(() => {
        stop();
        resolve();
      });
    });
  const shapes = (): Shape[] => {
    const { document } = store.getState();
    return document.order.flatMap((id) => {
      const shape = document.shapes.get(id);
      return shape === undefined ? [] : [shape];
    });
  };

  const api: BenchApi = {
    async load(count) {
      await fontsReady(editor);
      const scene = benchScene(count);
      const started = performance.now();
      const document = documentFromShapes(scene);
      const built = performance.now();
      const { width, height } = view();
      const area = { minX: 0, minY: 0, maxX: SCENE_WIDTH, maxY: SCENE_HEIGHT };
      const drawn = nextFrame();
      store.setState({
        document,
        camera: fitBounds(area, width, height, FIT_PADDING_PX),
        selectedIds: new Set(),
        history: EMPTY_HISTORY,
      });
      await drawn;
      return { buildMs: built - started, firstFrameMs: performance.now() - built };
    },

    animate(kind, frames) {
      const fitted = store.getState().camera;
      const { width, height } = view();
      const center = { x: width / 2, y: height / 2 };
      // 100% zoom, centered on the drawing: only part of it is on screen.
      const base =
        kind === 'pan100'
          ? { x: SCENE_WIDTH / 2 - width / 2, y: SCENE_HEIGHT / 2 - height / 2, zoom: 1 }
          : fitted;
      const timings = record();
      return new Promise((resolve) => {
        let frame = 0;
        const step = () => {
          if (frame === frames) {
            timings.stop();
            store.setState({ camera: fitted });
            resolve(frameStats(timings));
            return;
          }
          const phase = (frame / 120) * Math.PI * 2;
          // A new camera every frame, as continuous panning or pinching does.
          const camera =
            kind === 'zoom'
              ? zoomAt(base, center, 1.5 + Math.sin(phase))
              : panBy(base, Math.sin(phase) * width * 0.3, Math.cos(phase) * height * 0.2);
          store.setState({ camera });
          frame += 1;
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },

    drag(count, frames) {
      const { document, camera } = store.getState();
      const { width, height } = view();
      const rect = canvas.getBoundingClientRect();
      const all = shapes();
      // An unrotated rectangle whose top-left corner is mid-screen (clear of the
      // toolbars and panels) and hits the rectangle itself, to press on.
      const handle = all.find((shape) => {
        if (shape.type !== 'rectangle' || shape.rotation !== 0) return false;
        const x = (shape.x - camera.x) * camera.zoom;
        const y = (shape.y - camera.y) * camera.zoom;
        const central = x > width * 0.3 && x < width * 0.6 && y > height * 0.3 && y < height * 0.6;
        return central && hitTest(document, editor.index, shape, camera.zoom) === shape.id;
      });
      if (handle === undefined) throw new Error('No rectangle to drag.');
      const others = all.filter((shape) => shape !== handle).slice(0, count - 1);
      store.setState({ selectedIds: new Set([handle.id, ...others.map((shape) => shape.id)]) });
      const start = {
        x: rect.left + (handle.x - camera.x) * camera.zoom,
        y: rect.top + (handle.y - camera.y) * camera.zoom,
      };
      // Pointer 1 is the mouse, which is always active, so pointer capture works.
      const send = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: y,
          }),
        );
      send('pointerdown', start.x, start.y);
      const timings = record();
      return new Promise((resolve) => {
        let frame = 0;
        const step = () => {
          const angle = (frame / frames) * Math.PI * 2;
          const x = start.x + Math.sin(angle) * 160;
          const y = start.y + (1 - Math.cos(angle)) * 100;
          if (frame === frames) {
            timings.stop();
            send('pointerup', x, y);
            resolve(frameStats(timings));
            return;
          }
          send('pointermove', x, y);
          frame += 1;
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },

    hitTestMicros(batches) {
      const { document, camera } = store.getState();
      const { width, height } = view();
      const point = { x: 0, y: 0 };
      const perCall: number[] = [];
      // Timers are coarse in browsers, so calls are timed in batches and averaged.
      for (let batch = 0; batch < batches; batch++) {
        const points = Array.from({ length: HIT_TESTS_PER_BATCH }, () =>
          screenToWorld(camera, { x: Math.random() * width, y: Math.random() * height }),
        );
        const started = performance.now();
        for (const world of points) {
          point.x = world.x;
          point.y = world.y;
          hitTest(document, editor.index, point, camera.zoom);
        }
        perCall.push(((performance.now() - started) / HIT_TESTS_PER_BATCH) * 1000);
      }
      return summarize(perCall);
    },

    async fileTimes() {
      const all = shapes();
      const started = performance.now();
      const json = JSON.stringify(toFile(store.getState().document));
      const saved = performance.now();
      // What the file worker does when opening: parse and validate every shape.
      readFileText(json);
      const opened = performance.now();
      const exporter = createExportClient();
      const area = exportBounds(all);
      if (area === null) throw new Error('Nothing to export.');
      await exporter.render('png', all, area);
      const png = performance.now();
      await exporter.render('svg', all, area);
      const svg = performance.now();
      exporter.dispose();
      return {
        saveMs: saved - started,
        openMs: opened - saved,
        pngMs: png - opened,
        svgMs: svg - png,
      };
    },

    async editSession(minutes) {
      collectGarbage();
      const heapBeforeMB = heapMB();
      const ends = performance.now() + minutes * 60_000;
      let edits = 0;
      while (performance.now() < ends) {
        // A burst of edits, then a pause long enough for autosave, like real editing.
        for (let i = 0; i < 20; i++) {
          editOnce(editor, edits);
          edits += 1;
          await sleep(100);
        }
        await sleep(1000);
      }
      collectGarbage();
      return { heapBeforeMB, heapAfterMB: heapMB(), edits };
    },
  };
  (window as unknown as { __inkframeBench: BenchApi }).__inkframeBench = api;
}

/** One realistic edit: move a shape, and now and then duplicate, delete, or undo. */
function editOnce(editor: Editor, n: number): void {
  const { document } = editor.store.getState();
  const id = document.order[Math.floor(Math.random() * document.order.length)];
  const shape = id === undefined ? undefined : document.shapes.get(id);
  if (shape === undefined) return;
  editor.store.setState({ selectedIds: new Set([shape.id]) });
  const moved = { ...shape, x: shape.x + 3, y: shape.y - 2 };
  executeCommand(editor.store, updateShapesCommand('Move', [shape], [moved]));
  if (n % 5 === 0) {
    editor.perform('duplicate');
    editor.perform('delete');
  }
  if (n % 7 === 0) {
    editor.perform('undo');
  }
}

function fontsReady(editor: Editor): Promise<void> {
  return new Promise((resolve) => {
    if (editor.store.getState().fontsReady) {
      resolve();
      return;
    }
    const stop = editor.store.subscribe((state) => {
      if (state.fontsReady) {
        stop();
        resolve();
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chromium only; the runner launches it with --expose-gc and precise memory info. */
function collectGarbage(): void {
  (globalThis as { gc?: () => void }).gc?.();
}

function heapMB(): number {
  const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
  return memory === undefined ? Number.NaN : memory.usedJSHeapSize / 1024 / 1024;
}
