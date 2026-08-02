import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Precise SVG vector of the ConnectBoat Nautical Boat Logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="100%" height="100%">
  <g id="connectboat-nautical-logo">
    <!-- Top Hardtop / Spoiler Wedge -->
    <path fill="#081838" d="M 402 215 C 438 185, 520 172, 582 176 C 548 186, 492 195, 452 225 C 432 221, 412 218, 402 215 Z" />

    <!-- Cabin Roof Arch & Windshield Superstructure -->
    <path fill="#081838" d="M 345 295 C 415 260, 495 200, 612 192 C 648 190, 665 202, 635 222 C 565 250, 485 272, 410 298 C 382 298, 358 296, 345 295 Z" />

    <!-- Window Cutout / Negative Space (transparency cutout) -->
    <path fill="#FFFFFF" d="M 470 235 C 505 212, 555 204, 595 202 C 580 214, 540 232, 495 248 C 482 245, 474 240, 470 235 Z" />

    <!-- Main Boat Hull (Sleek Yacht Body & Sharp Bow) -->
    <path fill="#081838" d="M 368 306 C 485 275, 620 236, 785 236 C 715 276, 638 322, 585 328 C 475 332, 382 312, 358 308 C 362 307, 365 307, 368 306 Z" />

    <!-- Wave 1: Top Ocean Wave (Vibrant Blue) -->
    <path fill="#0066FF" d="M 230 352 C 320 320, 410 320, 498 348 C 580 374, 668 370, 760 352 C 682 380, 582 388, 490 362 C 405 338, 308 340, 230 352 Z" />

    <!-- Wave 2: Middle Ocean Wave (Bright Azure Blue) -->
    <path fill="#0099FF" d="M 270 372 C 348 348, 432 348, 510 372 C 580 394, 658 392, 735 380 C 665 402, 575 408, 492 388 C 415 368, 330 368, 270 372 Z" />

    <!-- Wave 3: Bottom Ocean Wave (Electric Cyan) -->
    <path fill="#00C8FF" d="M 315 394 C 382 376, 452 376, 515 394 C 570 410, 632 410, 692 402 C 638 418, 565 422, 502 408 C 440 392, 368 392, 315 394 Z" />
  </g>
</svg>`;

// Also a version with solid cutout window for transparency if needed
const svgTransparentWindow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="100%" height="100%">
  <g id="connectboat-nautical-logo">
    <!-- Top Hardtop / Spoiler Wedge -->
    <path fill="#081838" d="M 402 185 C 438 155, 520 142, 582 146 C 548 156, 492 165, 452 195 C 432 191, 412 188, 402 185 Z" />

    <!-- Cabin Roof Arch & Windshield Superstructure -->
    <path fill="#081838" d="M 345 265 C 415 230, 495 170, 612 162 C 648 160, 665 172, 635 192 C 565 220, 485 242, 410 268 C 382 268, 358 266, 345 265 Z" />

    <!-- Main Boat Hull (Sleek Yacht Body & Sharp Bow) -->
    <path fill="#081838" d="M 368 276 C 485 245, 620 206, 785 206 C 715 246, 638 292, 585 298 C 475 302, 382 282, 358 278 C 362 277, 365 277, 368 276 Z" />

    <!-- Wave 1: Top Ocean Wave (Vibrant Blue) -->
    <path fill="#0066FF" d="M 230 322 C 320 290, 410 290, 498 318 C 580 344, 668 340, 760 322 C 682 350, 582 358, 490 332 C 405 308, 308 310, 230 322 Z" />

    <!-- Wave 2: Middle Ocean Wave (Bright Azure Blue) -->
    <path fill="#0099FF" d="M 270 342 C 348 318, 432 318, 510 342 C 580 364, 658 362, 735 350 C 665 372, 575 378, 492 358 C 415 338, 330 338, 270 342 Z" />

    <!-- Wave 3: Bottom Ocean Wave (Electric Cyan) -->
    <path fill="#00C8FF" d="M 315 364 C 382 346, 452 346, 515 364 C 570 380, 632 380, 692 372 C 638 388, 565 392, 502 378 C 440 362, 368 362, 315 364 Z" />
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

  // Apple touch icon
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
    <g transform="translate(100, 40)">
      ${svgTransparentWindow.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="100%" height="100%">', '').replace('</svg>', '')}
    </g>
    <text x="600" y="480" font-family="sans-serif" font-weight="900" font-size="64" fill="#FFFFFF" text-anchor="middle" letter-spacing="-1">ConnectBoat</text>
    <text x="600" y="540" font-family="sans-serif" font-weight="600" font-size="24" fill="#38BDF8" text-anchor="middle" letter-spacing="2">UK MARINE &amp; BOAT MARKETPLACE</text>
  </svg>`;

  const ogBuffer = await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogBuffer);

  console.log('All icons and branding images generated successfully!');
}

generateAssets().catch(err => console.error(err));
