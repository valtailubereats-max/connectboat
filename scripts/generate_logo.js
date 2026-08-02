import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// SVG representation of the ConnectBoat Nautical Boat Logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="100%" height="100%">
  <g id="connectboat-nautical-logo">
    <!-- Top Aerodynamic Hardtop / Spoiler -->
    <path fill="#0A1838" d="M 405 212 C 450 185, 535 175, 608 180 C 570 188, 510 196, 460 225 C 438 222, 415 218, 405 212 Z" />

    <!-- Upper Cabin Arch & Windshield Superstructure -->
    <path fill="#0A1838" d="M 350 292 C 410 262, 500 205, 615 198 C 650 196, 665 208, 638 225 C 570 252, 490 272, 418 295 C 388 295, 362 294, 350 292 Z" />

    <!-- Cabin Window Cutout / Negative Space Accent (optional subtle inner arch) -->

    <!-- Main Yacht Hull Body -->
    <path fill="#0A1838" d="M 378 302 C 500 272, 630 238, 810 238 C 740 278, 660 322, 608 326 C 490 330, 392 308, 368 305 C 372 303, 375 303, 378 302 Z" />

    <!-- Wave 1 (Top Wave - Primary Blue) -->
    <path fill="#0072FF" d="M 230 355 C 320 320, 420 320, 510 350 C 590 376, 680 372, 782 352 C 700 380, 595 388, 500 360 C 410 334, 310 338, 230 355 Z" />

    <!-- Wave 2 (Middle Wave - Bright Sky Blue) -->
    <path fill="#0099FF" d="M 270 375 C 350 348, 440 348, 520 375 C 590 398, 670 396, 755 382 C 680 404, 585 410, 500 388 C 420 366, 330 368, 270 375 Z" />

    <!-- Wave 3 (Bottom Wave - Vivid Cyan Accent) -->
    <path fill="#00C3FF" d="M 320 398 C 390 378, 465 378, 530 398 C 585 414, 645 414, 710 405 C 650 422, 575 424, 510 408 C 445 392, 370 394, 320 398 Z" />
  </g>
</svg>`;

console.log('SVG created successfully');
