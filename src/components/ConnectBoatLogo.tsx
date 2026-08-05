import React from 'react';

interface ConnectBoatLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
  boatClassName?: string;
}

export const ConnectBoatLogo: React.FC<ConnectBoatLogoProps> = ({
  className = "h-8 w-auto",
  size,
  showText = false,
  textClassName = "text-xl font-black text-white tracking-tight",
  boatClassName = "text-current"
}) => {
  const style = size ? { width: `${size}px`, height: `${(size * 0.6)}px` } : undefined;

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="120 120 760 460"
        className={className}
        style={style}
        aria-label="ConnectBoat Logo"
      >
        <g id="connectboat-exact-reference-symbol">
          {/* 1. Top Slanted Radar / Antenna Fin */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M 405 160 L 423 136 L 439 140 L 421 164 Z"
          />

          {/* 2. Upper Cabin Arch & Hardtop */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M 330 236 C 378 196, 438 160, 520 160 C 572 160, 618 182, 642 202 C 596 197, 525 188, 442 208 C 392 220, 350 232, 330 236 Z"
          />

          {/* 3. Main Yacht Hull (Solid Navy / Dynamic Sheer Line & Sharp Bow) */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M 205 472 C 305 402, 425 332, 575 307 C 665 292, 765 277, 872 252 C 785 337, 715 412, 670 444 C 595 497, 490 497, 340 467 C 265 452, 212 464, 205 472 Z"
          />

          {/* 4. Single Fluid Ocean Wave (Vibrant Blue #0066FF) */}
          <path
            fill="#0066FF"
            d="M 135 536 C 230 471, 320 471, 420 498 C 510 522, 620 531, 830 491 C 720 554, 570 566, 420 538 C 300 516, 200 518, 135 536 Z"
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
