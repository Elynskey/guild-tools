// One-off/re-runnable build utility (not part of the app runtime): generates the
// Windows .ico and a general-purpose .png app icon from the guild crest. The source
// (assets/guild-emblem.png) is 245x251, not square, so each target size pads it onto
// a transparent square canvas rather than stretching/distorting the crest shape.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'guild-emblem.png');
const OUT_DIR = path.join(ROOT, 'build-resources');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZE = 512;

// Resize into ~86% of the canvas then center-pad to square, so the crest doesn't
// touch the edges (matching how app icons are conventionally inset).
async function squarePad(size) {
  const inner = Math.round(size * 0.86);
  return sharp(SOURCE)
    .resize(inner, inner, { fit: 'inside' })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const icoBuffers = await Promise.all(ICO_SIZES.map(squarePad));
  const icoBuffer = await pngToIco(icoBuffers);
  await writeFile(path.join(OUT_DIR, 'icon.ico'), icoBuffer);
  console.log('Wrote build-resources/icon.ico (sizes:', ICO_SIZES.join(', '), ')');

  const pngBuffer = await squarePad(PNG_SIZE);
  await writeFile(path.join(OUT_DIR, 'icon.png'), pngBuffer);
  console.log(`Wrote build-resources/icon.png (${PNG_SIZE}x${PNG_SIZE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
