// The Settings gear: a solid six-tooth cog drawn for this app.
export const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M9.40 5.50 L10.10 2.40 L13.90 2.40 L14.60 5.50 A7 7 0 0 1 16.33 6.50 L19.36 5.55 L21.26 8.85 L18.93 11.00 A7 7 0 0 1 18.93 13.00 L21.26 15.15 L19.36 18.45 L16.33 17.50 A7 7 0 0 1 14.60 18.50 L13.90 21.60 L10.10 21.60 L9.40 18.50 A7 7 0 0 1 7.67 17.50 L4.64 18.45 L2.74 15.15 L5.07 13.00 A7 7 0 0 1 5.07 11.00 L2.74 8.85 L4.64 5.55 L7.67 6.50 A7 7 0 0 1 9.40 5.50 Z M15.2 12a3.2 3.2 0 1 0 -6.4 0a3.2 3.2 0 1 0 6.4 0Z"
    />
  </svg>
)

export const ChevronLeftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

/** A monkey's head, solid, with the face cut out of it (the cut-out shows what is behind). */
export const MonkeyIcon = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="0 -51 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M62 128a62 62 0 1 0 0 124a62 62 0 1 0 0-124ZM62 154a36 36 0 1 1 0 72a36 36 0 1 1 0-72ZM450 128a62 62 0 1 0 0 124a62 62 0 1 0 0-124ZM450 154a36 36 0 1 1 0 72a36 36 0 1 1 0-72Z"
    />
    <path
      fillRule="evenodd"
      d="M254 18C190 22 110 60 90 130C80 180 85 250 100 300C120 360 190 392 256 392C322 392 392 360 412 300C427 250 432 180 420 130C400 60 320 22 254 18ZM256 105C225 95 185 100 150 118C115 140 108 190 125 220C140 245 150 270 148 300C148 345 190 375 256 375C322 375 364 345 364 300C362 270 372 245 387 220C404 190 397 140 362 118C327 100 287 95 256 105ZM187 171a17 17 0 1 0 0 34a17 17 0 1 0 0-34ZM326 171a17 17 0 1 0 0 34a17 17 0 1 0 0-34ZM243 216a6 6 0 1 0 0 12a6 6 0 1 0 0-12ZM270 216a6 6 0 1 0 0 12a6 6 0 1 0 0-12ZM192 290C232 302 280 302 320 290L326 302C284 318 228 318 186 302Z"
    />
  </svg>
)

const outline = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** A camera, for the Instagram row. */
export const CameraIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...outline} width={size} height={size}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
  </svg>
)

/** A steaming cup, for the coffee card. */
export const CoffeeIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...outline} width={size} height={size}>
    <path d="M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
    <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H15.6" />
    <path d="M8 3v3M12 3v3" />
  </svg>
)

/** An arrow leaving the app, for links that open another site. */
export const ArrowUpRightIcon = ({ size = 20 }: { size?: number }) => (
  <svg {...outline} width={size} height={size}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
)
