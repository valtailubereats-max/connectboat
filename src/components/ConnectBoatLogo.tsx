import React from 'react';

interface ConnectBoatLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export const ConnectBoatLogo: React.FC<ConnectBoatLogoProps> = ({
  className = "h-8 w-auto",
  size,
  showText = false,
  textClassName = "text-xl font-black text-white tracking-tight"
}) => {
  const style = size ? { width: `${size}px`, height: `${(size * 0.6)}px` } : undefined;

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 580 320"
        className={className}
        style={style}
        aria-label="ConnectBoat Logo"
      >
        <g id="connectboat-nautical-symbol">
          {/* Top Hardtop / Spoiler Wedge */}
          <path
            fill="#0A1838"
            className="dark:fill-slate-100"
            d="M 232 95 C 268 65, 350 52, 412 56 C 378 66, 322 75, 282 105 C 262 101, 242 98, 232 95 Z"
          />

          {/* Cabin Roof Arch & Windshield Superstructure */}
          <path
            fill="#0A1838"
            className="dark:fill-slate-100"
            d="M 175 175 C 245 140, 325 80, 442 72 C 478 70, 495 82, 465 102 C 395 130, 315 152, 240 178 C 212 178, 188 176, 175 175 Z"
          />

          {/* Main Boat Hull (Sleek Yacht Body & Sharp Bow) */}
          <path
            fill="#0A1838"
            className="dark:fill-slate-100"
            d="M 198 186 C 315 155, 450 116, 615 116 C 545 156, 468 202, 415 208 C 305 212, 212 192, 188 188 C 192 187, 195 187, 198 186 Z"
          />

          {/* Wave 1: Top Ocean Wave (Vibrant Blue) */}
          <path
            fill="#0066FF"
            d="M 60 232 C 150 200, 240 200, 328 228 C 410 254, 498 250, 590 232 C 512 260, 412 268, 320 242 C 235 218, 138 220, 60 232 Z"
          />

          {/* Wave 2: Middle Ocean Wave (Bright Azure Blue) */}
          <path
            fill="#0099FF"
            d="M 100 252 C 178 228, 262 228, 340 252 C 410 274, 488 272, 565 260 C 495 282, 405 288, 322 268 C 245 248, 160 248, 100 252 Z"
          />

          {/* Wave 3: Bottom Ocean Wave (Electric Cyan) */}
          <path
            fill="#00C8FF"
            d="M 145 274 C 212 256, 282 256, 345 274 C 400 290, 462 290, 522 282 C 468 298, 395 302, 332 288 C 270 272, 198 272, 145 274 Z"
          />
        </g>
      </svg>
      {showText && (
        <span className={textClassName}>
          ConnectBoat
        </span>
      )}
    </div>
  );
};

export default ConnectBoatLogo;
