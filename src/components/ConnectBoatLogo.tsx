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
  const style = size
    ? { width: `${size}px`, height: `${size * 0.6}px` }
    : undefined;

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 360"
        className={className}
        style={style}
        aria-label="ConnectBoat Logo"
        role="img"
      >
        <g id="connectboat-official-uk-symbol">

          {/* Left sail */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M286 42 C238 82 196 139 158 220 C199 205 239 199 280 201 Z"
          />

          {/* Mast */}
          <rect
            x="289"
            y="31"
            width="14"
            height="207"
            rx="7"
            fill="currentColor"
            className={boatClassName}
          />

          {/* Union Jack sail base */}
          <path
            d="M307 58 C354 88 397 139 432 216 C392 204 354 199 313 201 Z"
            fill="#173A78"
          />

          {/* Union Jack diagonals */}
          <path
            d="M311 66 L324 78 L421 202 L406 198 L315 88 Z"
            fill="#FFFFFF"
          />
          <path
            d="M426 205 L411 210 L316 105 L314 84 Z"
            fill="#FFFFFF"
          />
          <path
            d="M313 69 L322 77 L415 199 L406 197 L318 91 Z"
            fill="#E31E24"
          />
          <path
            d="M424 204 L416 207 L320 102 L317 90 Z"
            fill="#E31E24"
          />

          {/* Union Jack cross */}
          <path
            d="M310 128 L352 136 L420 160 L428 178 L351 151 L311 144 Z"
            fill="#FFFFFF"
          />
          <path
            d="M362 94 L378 108 L371 203 L353 201 Z"
            fill="#FFFFFF"
          />
          <path
            d="M311 134 L351 141 L424 167 L428 178 L351 151 L311 144 Z"
            fill="#E31E24"
          />
          <path
            d="M367 99 L376 108 L369 203 L358 202 Z"
            fill="#E31E24"
          />

          {/* Cabin */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M155 248 C178 224 203 214 235 214 L303 214 C322 215 339 223 352 237 L326 248 L199 248 Z"
          />

          {/* Cabin window */}
          <path
            d="M197 240 C210 228 226 224 244 224 L299 224 C310 224 321 229 329 237 L313 243 L190 243 Z"
            fill="#102B59"
          />

          {/* Hull */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="M120 248 C180 242 246 240 311 243 C378 245 438 240 493 226 C505 223 516 225 522 231 C486 268 445 292 400 307 C331 299 259 298 190 306 C155 310 126 307 107 298 C95 292 94 282 100 270 C105 260 112 252 120 248 Z"
          />

          {/* Hull accent */}
          <path
            d="M106 295 C188 276 270 264 355 257 C405 253 454 245 504 231 C461 253 414 270 355 281 C270 292 185 298 106 295 Z"
            fill="#102B59"
          />

          {/* Wave */}
          <path
            d="M92 318 C163 330 221 319 276 314 C336 309 390 325 450 321 C483 320 510 313 532 304 C497 329 457 339 413 335 C356 330 308 321 257 327 C197 334 139 337 92 318 Z"
            fill="#38A8F0"
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
