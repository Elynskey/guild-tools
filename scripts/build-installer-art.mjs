// One-off/re-runnable build utility: generates the NSIS installer's branding images
// (installerSidebar.bmp for the Welcome/Finish pages, installerHeader.bmp for every
// other page -- see electron-builder's nsisOptions.d.ts for the exact contract: sidebar
// is 164x314, header is the standard NSIS MUI_HEADERIMAGE size of 150x57) so the
// installer matches the app's own dark/gold theme instead of NSIS's generic default.
//
// sharp can't write .bmp directly (not in its supported output formats), and NSIS
// requires a real uncompressed BMP -- so this renders PNGs with sharp, then shells out
// to PowerShell's System.Drawing to re-save each as a 24-bit BMP (no alpha channel,
// which NSIS doesn't support here anyway -- both canvases are fully opaque already).
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const CREST = path.join(ROOT, 'assets', 'guild-emblem.png');
const OUT_DIR = path.join(ROOT, 'build-resources');

// Exact palette from src/design-system/tokens/colors.css (dark theme) -- not
// approximated, so the installer reads as the same brand, not just "also dark."
const STONE_900 = { r: 0x12, g: 0x10, b: 0x0c }; // --surface-page
const STONE_800 = { r: 0x18, g: 0x15, b: 0x10 }; // --surface-raised
const GOLD_300 = '#d4b358'; // --text-gold
const PARCHMENT_100 = '#f6efdd'; // --text-strong

// text-anchor="middle" at x=width/2 so long lines shrink toward center rather than
// needing exact width math up front -- still sized conservatively per call site so
// nothing clips the edge of its (narrow) container.
function centeredSvg(width, height, lines) {
  const spans = lines
    .map(({ text, y, size, fill, opacity = 1, weight = 400, spacing = 0 }) => `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="${fill}" opacity="${opacity}">${text}</text>`)
    .join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${spans}</svg>`);
}

async function buildSidebar() {
  const W = 164;
  const H = 314;
  const crestSize = 104;
  const crest = await sharp(CREST).resize(crestSize, crestSize, { fit: 'inside' }).png().toBuffer();
  const crestMeta = await sharp(crest).metadata();
  const crestTop = 40;
  const ruleTop = crestTop + crestMeta.height + 20;

  const text = centeredSvg(W, 60, [
    { text: 'CASUAL RAID DAYS', y: 20, size: 11.5, weight: 700, fill: GOLD_300, spacing: 0.6 },
    { text: 'Guild Tools', y: 40, size: 10, fill: PARCHMENT_100, opacity: 0.75 },
  ]);

  return sharp({ create: { width: W, height: H, channels: 3, background: STONE_900 } })
    .composite([
      { input: crest, left: Math.round((W - crestMeta.width) / 2), top: crestTop },
      // Thin gold rule under the crest, matching the app's own eyebrow-rule pattern.
      { input: Buffer.from(`<svg width="${W - 32}" height="2"><rect width="100%" height="100%" fill="${GOLD_300}" opacity="0.55"/></svg>`), left: 16, top: ruleTop },
      { input: text, left: 0, top: ruleTop + 14 },
    ])
    .png()
    .toBuffer();
}

async function buildHeader() {
  const W = 150;
  const H = 57;
  const crestSize = 36;
  const crest = await sharp(CREST).resize(crestSize, crestSize, { fit: 'inside' }).png().toBuffer();
  const crestMeta = await sharp(crest).metadata();
  const textLeft = 10 + crestSize + 10;
  const textWidth = W - textLeft;

  const text = centeredSvg(textWidth, H, [
    { text: 'CRD', y: 25, size: 15, weight: 700, fill: GOLD_300, spacing: 1.2 },
    { text: 'Guild Tools', y: 41, size: 9.5, fill: PARCHMENT_100, opacity: 0.75 },
  ]);

  return sharp({ create: { width: W, height: H, channels: 3, background: STONE_800 } })
    .composite([
      { input: crest, left: 10, top: Math.round((H - crestMeta.height) / 2) },
      { input: text, left: textLeft, top: 0 },
    ])
    .png()
    .toBuffer();
}

// PowerShell + System.Drawing round-trip: sharp writes the PNG, this loads it and
// re-saves as BMP -- the one reliable BMP encoder already on this machine, no new
// dependency needed.
function pngToBmp(pngPath, bmpPath) {
  const script = `
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile('${pngPath}')
    $bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
    $bmp.Save('${bmpPath}', [System.Drawing.Imaging.ImageFormat]::Bmp)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  `;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sidebarPng = path.join(OUT_DIR, 'installerSidebar.png');
  const sidebarBmp = path.join(OUT_DIR, 'installerSidebar.bmp');
  await writeFile(sidebarPng, await buildSidebar());
  pngToBmp(sidebarPng, sidebarBmp);
  await unlink(sidebarPng); // BMP is the only artifact NSIS/git needs -- the PNG was just a hop to get there
  console.log('Wrote build-resources/installerSidebar.bmp (164x314)');

  const headerPng = path.join(OUT_DIR, 'installerHeader.png');
  const headerBmp = path.join(OUT_DIR, 'installerHeader.bmp');
  await writeFile(headerPng, await buildHeader());
  pngToBmp(headerPng, headerBmp);
  await unlink(headerPng);
  console.log('Wrote build-resources/installerHeader.bmp (150x57)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
