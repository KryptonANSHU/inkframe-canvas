import { TEXT_FONT_FAMILY } from '../text/font';

const FONT_URL = `${import.meta.env.BASE_URL}fonts/instrument-sans-latin-400-normal.woff2`;

/**
 * Loads the canvas text font with the FontFace API. Fonts added to `document.fonts`
 * are also available to CSS, so the text editor overlay uses the same face.
 */
export async function loadTextFont(): Promise<void> {
  const face = new FontFace(TEXT_FONT_FAMILY, `url(${FONT_URL}) format('woff2')`, {
    weight: '400',
    style: 'normal',
  });
  document.fonts.add(face);
  await face.load();
}
