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
  const style = size ? { width: `${size}px`, height: `${(size * 0.57)}px` } : undefined;

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 320"
        className={className}
        style={style}
        aria-label="ConnectBoat Logo"
      >
        <g id="connectboat-nautical-symbol">
          {/* Top Hardtop / Spoiler Wedge */}
          <path
            fill="currentColor"
            className="text-[#081838] dark:text-slate-100"
            d="M 235 75 C 272 45, 355 32, 418 36 C 382 46, 325 56, 285 86 C 265 82, 245 78, 235 75 Z"
          />

          {/* Cabin Roof Arch & Windshield Superstructure (Sleek & Minimalist) */}
          <path
            fill="currentColor"
            className="text-[#081838] dark:text-slate-100"
            d="M 178 155 C 248 120, 330 60, 448 52 C 485 50, 502 62, 470 82 C 398 110, 318 132, 242 158 C 215 158, 190 156, 178 155 Z"
          />

          {/* Main Boat Hull (Thickened 8-10% & Sharp Bow, Moved Close to Waves) */}
          <path
            fill="currentColor"
            className="text-[#081838] dark:text-slate-100"
            d="M 198 166 C 318 133, 458 94, 625 94 C 550 138, 468 188, 408 194 C 290 199, 212 175, 188 170 C 192 168, 195 167, 198 166 Z"
          />

          {/* Wave 1: Top Ocean Wave (Vibrant Blue - Reduced ~15% & Moved Close under Hull) */}
          <path
            fill="#0066FF"
            d="M 98 208 C 178 180, 262 180, 342 202 C 418 224, 498 220, 580 204 C 508 228, 415 236, 332 214 C 255 192, 170 194, 98 208 Z"
          />

          {/* Wave 2: Middle Ocean Wave (Bright Azure Blue) */}
          <path
            fill="#0099FF"
            d="M 138 225 C 210 204, 288 204, 358 224 C 422 242, 492 240, 560 230 C 498 248, 418 254, 342 236 C 270 218, 192 218, 138 225 Z"
          />

          {/* Wave 3: Bottom Ocean Wave (Electric Cyan) */}
          <path
            fill="#00C8FF"
            d="M 180 242 C 240 226, 305 226, 362 242 C 412 256, 468 256, 522 248 C 472 262, 408 266, 352 254 C 295 240, 230 240, 180 242 Z"
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
