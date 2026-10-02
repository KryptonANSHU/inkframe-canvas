import { createContextTextMeasurer } from '../core/dom/canvasTextMeasurer';
import { pngScale } from '../core/export/pngScale';
import { shapesToSvg } from '../core/export/svg';
import { documentFromShapes } from '../core/persistence/fileFormat';
import { createRenderer } from '../core/renderer';
import { createEditorStore } from '../core/store';
import type { TextFont } from '../core/shapes';
import { TEXT_FACES, textFont } from '../core/text/font';
import { createTextLayoutCache } from '../core/text/layout';
import type { ExportRequest, ExportResponse } from './exportProtocol';

/**
 * Renders exports off the main thread: PNG through the editor's own renderer on an
 * OffscreenCanvas, SVG as markup with the text font embedded. Text is laid out with
 * the real font here too, so lines break exactly as on the canvas.
 */
const post = (message: ExportResponse) => {
  self.postMessage(message);
};

self.onmessage = ({ data }: MessageEvent<ExportRequest>) => {
  exportImage(data).then(
    (blob) => {
      post({ id: data.id, type: 'done', blob });
    },
    (error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      post({ id: data.id, type: 'failed', message: `The export failed (${reason}). Try again.` });
    },
  );
};

async function exportImage(request: ExportRequest): Promise<Blob> {
  // Only the faces this export uses are loaded or embedded.
  const faces = [
    ...new Set(request.shapes.flatMap((shape) => (shape.type === 'text' ? [textFont(shape)] : []))),
  ];
  await Promise.all(faces.map((face) => loadFont(face, request.fontUrls[face])));
  const context = new OffscreenCanvas(1, 1).getContext('2d');
  if (context === null) {
    throw new Error('no 2D canvas in workers');
  }
  const layouts = createTextLayoutCache(createContextTextMeasurer(context));
  if (request.format === 'svg') {
    const fontCss =
      faces.length === 0
        ? null
        : (
            await Promise.all(faces.map((face) => embeddedFontCss(face, request.fontUrls[face])))
          ).join('');
    const svg = shapesToSvg(
      request.shapes,
      request.area,
      (shape) => layouts.layout(shape),
      fontCss,
    );
    return new Blob([svg], { type: 'image/svg+xml' });
  }
  return renderPng(request, (shape) => layouts.layout(shape));
}

async function renderPng(
  { shapes, area }: ExportRequest,
  layout: Parameters<typeof createRenderer>[1],
): Promise<Blob> {
  const width = area.maxX - area.minX;
  const height = area.maxY - area.minY;
  const scale = pngScale(width, height);
  const pixelWidth = Math.max(1, Math.ceil(width * scale));
  const pixelHeight = Math.max(1, Math.ceil(height * scale));
  const canvas = new OffscreenCanvas(pixelWidth, pixelHeight);
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('the image is too large for this browser');
  }
  // An editor state with only these shapes, the camera on the export area, no selection.
  const state = createEditorStore({
    document: documentFromShapes(shapes),
    camera: { x: area.minX, y: area.minY, zoom: 1 },
    fontsReady: true,
  }).getState();
  createRenderer(context, layout).draw(state, { pixelWidth, pixelHeight, devicePixelRatio: scale });
  return canvas.convertToBlob({ type: 'image/png' });
}

const fontsLoaded = new Map<TextFont, Promise<void>>();

/** Workers have their own font set; each text face must be loaded into it once. */
function loadFont(font: TextFont, url: string): Promise<void> {
  const loading =
    fontsLoaded.get(font) ??
    (async () => {
      // Declared on WorkerGlobalScope, which the DOM typings this project uses don't include.
      const { fonts } = self as unknown as { fonts?: FontFaceSet };
      if (fonts === undefined) {
        throw new Error("this browser can't load fonts in workers");
      }
      const face = new FontFace(TEXT_FACES[font].family, `url(${url}) format('woff2')`, {
        weight: '400',
        style: 'normal',
      });
      fonts.add(face);
      await face.load();
    })().catch((error: unknown) => {
      // Not cached, so the next export tries again.
      fontsLoaded.delete(font);
      throw error;
    });
  fontsLoaded.set(font, loading);
  return loading;
}

/** An @font-face rule with the font inlined, so the SVG renders the same anywhere. */
async function embeddedFontCss(font: TextFont, url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('the text font could not be fetched');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  // In chunks: spreading a whole font into String.fromCharCode overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `@font-face{font-family:"${TEXT_FACES[font].family}";src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");}`;
}
