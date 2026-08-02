import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Refined SVG vector of ConnectBoat Nautical Logo according to specifications:
// 1. Waves reduced by ~15%
// 2. Waves moved closer to the hull keel
// 3. Hull thickened by ~8-10% for strong small-scale legibility
// 4. Sleeker, minimalist cabin arch
// 5. Perfect optical alignment and balance for favicons and PWA icons
// 6. Same vibrant colors: Dark Navy (#081838), Ocean Blue (#0066FF), Azure (#0099FF), Electric Cyan (#00C8FF)

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">
  <g id="connectboat-nautical-logo">
    <!-- Top Hardtop / Spoiler Wedge -->
    <path fill="#081838" d="M 235 95 C 272 65, 355 52, 418 56 C 382 66, 325 76, 285 106 C 265 102, 245 98, 235 95 Z" />

    <!-- Cabin Roof Arch & Windshield Superstructure (Minimalist & Sleek) -->
    <path fill="#081838" d="M 178 175 C 248 140, 330 80, 448 72 C 485 70, 502 82, 470 102 C 398 130, 318 152, 242 178 C 215 178, 190 176, 178 175 Z" />

    <!-- Sleek Window Cutout (Negative Space Transparency) -->
    <path fill="#FFFFFF" d="M 305 115 C 342 92, 395 84, 435 82 C 418 94, 378 112, 330 128 C 318 125, 310 120, 305 115 Z" />

    <!-- Main Boat Hull (Thickened 8-10% & Sharp Bow) -->
    <path fill="#081838" d="M 198 186 C 318 153, 458 114, 625 114 C 550 158, 468 208, 408 214 C 290 219, 212 195, 188 190 C 192 188, 195 187, 198 186 Z" />

    <!-- Wave 1: Top Ocean Wave (Vibrant Blue - Moved closer to hull, scaled down) -->
    <path fill="#0066FF" d="M 98 228 C 178 200, 262 200, 342 222 C 418 244, 498 240, 580 224 C 508 248, 415 256, 332 234 C 255 212, 170 214, 98 228 Z" />

    <!-- Wave 2: Middle Ocean Wave (Bright Azure Blue) -->
    <path fill="#0099FF" d="M 138 245 C 210 224, 288 224, 358 244 C 422 262, 492 260, 560 250 C 498 268, 418 274, 342 256 C 270 238, 192 238, 138 245 Z" />

    <!-- Wave 3: Bottom Ocean Wave (Electric Cyan) -->
    <path fill="#00C8FF" d="M 180 262 C 240 246, 305 246, 362 262 C 412 276, 468 276, 522 268 C 472 282, 408 286, 352 274 C 295 260, 230 260, 180 262 Z" />
  </g>
</svg>`;

// Transparent window version for versatile backgrounds (e.g. Dark Mode & Light Mode Header)
const svgTransparentWindow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">
  <g id="connectboat-nautical-logo">
    <!-- Top Hardtop / Spoiler Wedge -->
    <path fill="#081838" d="M 235 95 C 272 65, 355 52, 418 56 C 382 66, 325 76, 285 106 C 265 102, 245 98, 235 95 Z" />

    <!-- Cabin Roof Arch & Windshield Superstructure (Minimalist & Sleek) -->
    <path fill="#081838" d="M 178 175 C 248 140, 330 80, 448 72 C 485 70, 502 82, 470 102 C 398 130, 318 152, 242 178 C 215 178, 190 176, 178 175 Z" />

    <!-- Main Boat Hull (Thickened 8-10% & Sharp Bow) -->
    <path fill="#081838" d="M 198 186 C 318 153, 458 114, 625 114 C 550 158, 468 208, 408 214 C 290 219, 212 195, 188 190 C 192 188, 195 187, 198 186 Z" />

    <!-- Wave 1: Top Ocean Wave (Vibrant Blue - Moved closer to hull, scaled down) -->
    <path fill="#0066FF" d="M 98 228 C 178 200, 262 200, 342 222 C 418 244, 498 240, 580 224 C 508 248, 415 256, 332 234 C 255 212, 170 214, 98 228 Z" />

    <!-- Wave 2: Middle Ocean Wave (Bright Azure Blue) -->
    <path fill="#0099FF" d="M 138 245 C 210 224, 288 224, 358 244 C 422 262, 492 260, 560 250 C 498 268, 418 274, 342 256 C 270 238, 192 238, 138 245 Z" />

    <!-- Wave 3: Bottom Ocean Wave (Electric Cyan) -->
    <path fill="#00C8FF" d="M 180 262 C 240 246, 305 246, 362 262 C 412 276, 468 276, 522 268 C 472 282, 408 286, 352 274 C 295 260, 230 260, 180 262 Z" />
  </g>
</svg>`;

async function generateAssets() {
  const publicIconsDir = path.join(process.cwd(), 'public', 'icons');
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(process.cwd(), 'src', 'assets');

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Save SVG logo file
  fs.writeFileSync(path.join(assetsDir, 'connectboat-logo.svg'), svgTransparentWindow);
  fs.writeFileSync(path.join(publicDir, 'connectboat-logo.svg'), svgTransparentWindow);

  console.log('Saved SVG logos');

  // Render PNG icon for various sizes
  const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

  // For PWA app icons, render square padding with transparent background
  for (const size of sizes) {
    const pngBuffer = await sharp(Buffer.from(svgTransparentWindow))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(publicIconsDir, `icon-${size}.png`), pngBuffer);
  }

  // Apple touch icon with crisp white padding
  const appleTouchIcon = await sharp(Buffer.from(svgTransparentWindow))
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'apple-touch-icon.png'), appleTouchIcon);

  // Favicon.ico / png
  const favicon32 = await sharp(Buffer.from(svgTransparentWindow))
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon32);

  // Open Graph image (1200x630)
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="100%" height="100%">
    <rect width="100%" height="100%" fill="#0F172A" />
    <g transform="translate(180, 60)">
      ${svgTransparentWindow.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">', '').replace('</svg>', '')}
    </g>
    <text x="600" y="470" font-family="sans-serif" font-weight="900" font-size="64" fill="#FFFFFF" text-anchor="middle" letter-spacing="-1">ConnectBoat</text>
    <text x="600" y="530" font-family="sans-serif" font-weight="600" font-size="24" fill="#38BDF8" text-anchor="middle" letter-spacing="2">UK MARINE &amp; BOAT MARKETPLACE</text>
  </svg>`;

  const ogBuffer = await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogBuffer);

  console.log('All icons and branding images generated successfully!');
}

generateAssets().catch(err => console.error(err));
