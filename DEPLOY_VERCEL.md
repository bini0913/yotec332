# Vercel Deployment (YOTEC)

This repository is configured for static deployment on Vercel with `vercel.json` at repo root.

## What is configured
- `/` serves `YOTEC/index.html`
- `/js/*` serves `YOTEC/js/*`
- `/style.css` serves `YOTEC/style.css`
- all non-asset routes fallback to `YOTEC/index.html` (SPA behavior)

## Deploy steps
1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Framework preset: **Other** (no build command required).
4. Root directory: repository root.
5. Deploy.

## Notes
- `YOTEC/server.js` is for local Node serving only and is not required by Vercel static hosting.
- The app uses browser-side API calls to Gemini; ensure your key usage and quota are configured appropriately.
