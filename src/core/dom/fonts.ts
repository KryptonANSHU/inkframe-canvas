import type { TextFont } from '../shapes';
import { TEXT_FACES } from '../text/font';

/** Each text face's file, served from `public/` (OFL). Exports embed or load them too. */
export const FONT_URLS: Readonly<Record<TextFont, string>> = {
  hand: `${import.meta.env.BASE_URL}fonts/${TEXT_FACES.hand.file}`,
  sans: `${import.meta.env.BASE_URL}fonts/${TEXT_FACES.sans.file}`,
  mono: `${import.meta.env.BASE_URL}fonts/${TEXT_FACES.mono.file}`,
};

/**
 * Loads every canvas text face with the FontFace API, in parallel. Fonts added to
 * `document.fonts` are also available to CSS, so the text editor overlay uses them.
 */
export async function loadTextFonts(): Promise<void> {
  await Promise.all(
    (Object.keys(TEXT_FACES) as TextFont[]).map(async (font) => {
      const face = new FontFace(
        TEXT_FACES[font].family,
        `url(${FONT_URLS[font]}) format('woff2')`,
        {
          weight: '400',
          style: 'normal',
        },
      );
      document.fonts.add(face);
      await face.load();
    }),
  );
}
