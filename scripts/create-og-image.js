import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateOgImage() {
  const width = 1200;
  const height = 630;

  // 1. Download or load luxury yacht photo
  let backgroundBuffer;
  const photoUrl = 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&h=630&q=90';
  
  try {
    console.log('Fetching background yacht image from Unsplash...');
    const res = await fetch(photoUrl);
    if (res.ok) {
      backgroundBuffer = Buffer.from(await res.arrayBuffer());
    }
  } catch (err) {
    console.warn('Could not download Unsplash photo, using pure SVG background:', err.message);
  }

  // Read logo emblem SVG from public/connectboat-exact-logo.svg
  const logoPath = path.join(process.cwd(), 'public', 'connectboat-exact-logo.svg');
  let logoSvg = '';
  if (fs.existsSync(logoPath)) {
    logoSvg = fs.readFileSync(logoPath, 'utf-8');
  }

  // Create overlay SVG with ConnectBoat branding, gradients, text, badge, and logo emblem
  const overlaySvg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Deep Marine Navy Overlay Gradients -->
      <linearGradient id="marineDark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#030b1e" stop-opacity="0.92" />
        <stop offset="45%" stop-color="#061d43" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#0284c7" stop-opacity="0.40" />
      </linearGradient>

      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1e3d" stop-opacity="0.88" />
        <stop offset="100%" stop-color="#031027" stop-opacity="0.92" />
      </linearGradient>

      <linearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="50%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#2563eb" />
      </linearGradient>

      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5" />
      </filter>
    </defs>

    <!-- Dark Marine Vignette Overlay over background photo -->
    <rect width="${width}" height="${height}" fill="url(#marineDark)" />

    <!-- Decorative Top Wave / Accent Bar -->
    <rect x="0" y="0" width="${width}" height="8" fill="url(#accentGlow)" />

    <!-- Glassmorphism Brand Container Card -->
    <g filter="url(#shadow)">
      <rect x="70" y="80" width="1060" height="470" rx="24" fill="url(#cardBg)" stroke="#1e3a8a" stroke-width="2" stroke-opacity="0.5" />
    </g>

    <!-- UK Badge -->
    <g transform="translate(120, 130)">
      <rect width="185" height="38" rx="19" fill="#0284c7" fill-opacity="0.25" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.5" />
      <text x="20" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#38bdf8" letter-spacing="1.5">
        UNITED KINGDOM 🇬🇧
      </text>
    </g>

    <!-- ConnectBoat Main Title -->
    <text x="120" y="245" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="72" font-weight="900" fill="#ffffff" letter-spacing="-1">
      ConnectBoat
    </text>

    <!-- Subtitle -->
    <text x="120" y="305" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#0284c7" letter-spacing="0.5">
      UK Marine &amp; Boat Marketplace
    </text>

    <!-- Feature Pill Badges -->
    <g transform="translate(120, 350)">
      <g transform="translate(0, 0)">
        <rect width="160" height="42" rx="12" fill="#0f2b5c" stroke="#1d4ed8" stroke-width="1" />
        <text x="20" y="26" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#93c5fd">
          🚤 Buy &amp; Sell Boats
        </text>
      </g>
      <g transform="translate(176, 0)">
        <rect width="180" height="42" rx="12" fill="#0f2b5c" stroke="#1d4ed8" stroke-width="1" />
        <text x="20" y="26" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#93c5fd">
          ⚓ Charters &amp; Gear
        </text>
      </g>
      <g transform="translate(372, 0)">
        <rect width="180" height="42" rx="12" fill="#0f2b5c" stroke="#1d4ed8" stroke-width="1" />
        <text x="20" y="26" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#93c5fd">
          🛠️ Marine Services
        </text>
      </g>
    </g>

    <!-- Bottom URL Tag -->
    <g transform="translate(120, 480)">
      <text x="0" y="0" font-family="-apple-system, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="0.5">
        connectboat.co.uk
      </text>
    </g>

    <!-- ConnectBoat Emblem Icon on Right side of Card -->
    <g transform="translate(710, 150) scale(0.65)">
      <!-- Render logo vector with glowing white/cyan hues -->
      <!-- White Yacht Hull -->
      <path fill="#FFFFFF" d="M 205 472 C 305 402, 425 332, 575 307 C 665 292, 765 277, 872 252 C 785 337, 715 412, 670 444 C 595 497, 490 497, 340 467 C 265 452, 212 464, 205 472 Z" />
      <path fill="#FFFFFF" d="M 330 236 C 378 196, 438 160, 520 160 C 572 160, 618 182, 642 202 C 596 197, 525 188, 442 208 C 392 220, 350 232, 330 236 Z" />
      <path fill="#FFFFFF" d="M 405 160 L 423 136 L 439 140 L 421 164 Z" />
      <!-- Cyan Ocean Wave -->
      <path fill="#38BDF8" d="M 135 536 C 230 471, 320 471, 420 498 C 510 522, 620 531, 830 491 C 720 554, 570 566, 420 538 C 300 516, 200 518, 135 536 Z" />
    </g>

  </svg>
  `;

  let pipeline;
  if (backgroundBuffer) {
    // Resize background photo to 1200x630 and composite SVG overlay on top
    pipeline = sharp(backgroundBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }]);
  } else {
    // Pure SVG rendering to 1200x630 PNG
    pipeline = sharp(Buffer.from(overlaySvg)).resize(width, height);
  }

  const outputPath = path.join(process.cwd(), 'public', 'og-image.png');
  await pipeline.png({ quality: 95 }).toFile(outputPath);

  console.log(`Successfully generated 1200x630 OG image at: ${outputPath}`);

  // Verify file size and dimensions
  const metadata = await sharp(outputPath).metadata();
  console.log(`Image Metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}, size: ${fs.statSync(outputPath).size} bytes`);
}

generateOgImage().catch((err) => {
  console.error('Error generating OG image:', err);
  process.exit(1);
});
