# Project Preservation Rules

To guarantee the integrity of the application's branding, PWA specifications, and production-ready visual assets, the AI Assistant **MUST** strictly adhere to the following negative constraints at all times:

## 🚫 Forbidden File Modifications

1. **PWA Icons & Favicons:**
   - **NEVER** modify, overwrite, regenerate, or delete any image files in the `/public/` directory (including, but not limited to, `public/icon.png`, `public/icon-512x512.png`, `public/icon-192x192.png`, `public/favicon.ico`, or any other logo/icon file).
   - Do not attempt to run scripts like `generate-icons.js` or substitute default placeholder images.

2. **Web App Manifest:**
   - **NEVER** modify the manifest structure or values (`manifest.json` or equivalent webmanifest configurations) unless explicitly and specifically requested with exact property changes.
   - Do not overwrite configuration profiles that define app shortcuts, orientations, colors, or screenshots.

3. **Screenshots:**
   - **NEVER** replace, resize, or alter any screenshots intended for PWA prompt presentation or app store/GitHub listings.

## ✍️ How to Apply Changes

- Focus only on application features, React components, state logic, styling utility classes, or Firestore schema designs.
- Leave all native platform assets untouched so they sync cleanly with GitHub.
