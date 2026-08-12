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
        viewBox="0 0 600 360"
        className={className}
        style={style}
        aria-label="ConnectBoat Logo"
      >
        <g id="connectboat-official-uk-symbol">

          {/* 1. Left White Sail */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="
              M 286 42
              C 238 82, 196 139, 158 220
              C 199 205, 239 199, 280 201
              Z
            "
          />

          {/* 2. Mast */}
          <rect
            x="289"
            y="31"
            width="14"
            height="207"
            rx="7"
            fill="currentColor"
            className={boatClassName}
          />

          {/* 3. Right Sail - Union Jack Blue Base */}
          <path
            d="
              M 307 58
              C 354 88, 397 139, 432 216
              C 392 204, 354 199, 313 201
              Z
            "
            fill="#173A78"
          />

          {/* 4. Union Jack White Diagonals */}
          <path
            d="
              M 311 66
              L 324 78
              L 421 202
              L 406 198
              L 315 88
              Z
            "
            fill="#FFFFFF"
          />

          <path
            d="
              M 426 205
              L 411 210
              L 316 105
              L 314 84
              Z
            "
            fill="#FFFFFF"
          />

          {/* 5. Union Jack Red Diagonals */}
          <path
            d="
              M 313 69
              L 322 77
              L 415 199
              L 406 197
              L 318 91
              Z
            "
            fill="#E31E24"
          />

          <path
            d="
              M 424 204
              L 416 207
              L 320 102
              L 317 90
              Z
            "
            fill="#E31E24"
          />

          {/* 6. Union Jack White Cross */}
          <path
            d="
              M 310 128
              L 352 136
              L 420 160
              L 428 178
              L 351 151
              L 311 144
              Z
            "
            fill="#FFFFFF"
          />

          <path
            d="
              M 362 94
              L 378 108
              L 371 203
              L 353 201
              Z
            "
            fill="#FFFFFF"
          />

          {/* 7. Union Jack Red Cross */}
          <path
            d="
              M 311 134
              L 351 141
              L 424 167
              L 428 178
              L 351 151
              L 311 144
              Z
            "
            fill="#E31E24"
          />

          <path
            d="
              M 367 99
              L 376 108
              L 369 203
              L 358 202
              Z
            "
            fill="#E31E24"
          />

          {/* 8. Yacht Cabin */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="
              M 155 248
              C 178 224, 203 214, 235 214
              L 303 214
              C 322 215, 339 223, 352 237
              L 326 248
              L 199 248
              Z
            "
          />

          {/* 9. Cabin Window */}
          <path
            d="
              M 197 240
              C 210 228, 226 224, 244 224
              L 299 224
              C 310 224, 321 229, 329 237
              L 313 243
              L 190 243
              Z
            "
            fill="#102B59"
          />

          {/* 10. Main Yacht Hull */}
          <path
            fill="currentColor"
            className={boatClassName}
            d="
              M 120 248
              C 180 242, 246 240, 311 243
              C 378 245, 438 240, 493 226
              C 505 223, 516 225, 522 231
              C 486 268, 445 292, 400 307
              C 331 299, 259 298, 190 306
              C 155 310, 126 307, 107 298
              C 95 292, 94 282, 100 270
              C 105 260, 112 252, 120 248
              Z
            "
          />

          {/* 11. Hull Accent */}
          <path
            d="
              M 106 295
              C 188 276, 270 264, 355
