# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Music collectors and audiophiles who want to search Qobuz's catalogue and download releases in high-quality formats (FLAC, ALAC, MP3, etc.) without touching CLI tools. They arrive with an artist/album in mind, scan results quickly, pick a quality, and walk away with files. Self-hosters also deploy their own instance via Docker.

## Product Purpose

A frontend browser client for searching and downloading music from Qobuz. Success is: user searches, recognizes the right release fast, downloads in the format they want, done.

## Positioning

A polished, zero-install web UI over the Qobuz catalogue — the friendly face for what is otherwise a terminal workflow. (Community fork of Qobuz-DL.)

## Operating Context

- Flow: search (albums/artists/tracks filters) → browse releases (cards, artist discographies, infinite scroll) → quality pick → download (ZIP pack; client-side ffmpeg transcode when a lossy format is chosen).
- Runs entirely in the browser against its own `/api/*` routes proxying the Qobuz API; credentials come from server env (QOBUZ_APP_ID etc.), never the user.
- Deployed either on Vercel-style hosting or self-hosted Docker; theming follows OS via next-themes with a dark default.

## Capabilities and Constraints

- Search, artist/album/track views, quality selection, ZIP downloads, optional client-side transcoding (ffmpeg.wasm), country token handling.
- UI copy and feature set are product truth — do not invent features or claims.
- Must keep working: react-country-flag imagery, remote album art from static.qobuz.com (Next Image allow-list), CORS/COEP headers required by ffmpeg.wasm.
- App name is configurable via `NEXT_PUBLIC_APPLICATION_NAME` (default "Qobuz-DL"); settings persisted client-side include toggling the background effect.

## Brand Commitments

Name: Qobuz-DL. Discord + GitHub links in the header are binding content. "Qobuz-DL" banner logo used when the app name matches.

## Evidence on Hand

Real album art via Qobuz static CDN (grayscale-friendly when filtered); changelog.json feeds a changelog dialog. No testimonials, marketing claims, or press assets — do not fabricate any.

## Product Principles

1. Speed to the right release — scanning results is the core loop; hierarchy must make titles/artwork dominate.
2. Calm void — the catalogue is the color; chrome stays quiet so artwork reads true.
3. Precision cues — downloads and quality choices are technical acts; give them exact, mono-readout treatment.
4. Everything survives state — empty, loading, error, and settings states are first-class surfaces, not afterthoughts.

## Accessibility & Inclusion

Dark-first but light theme must remain fully readable. Keyboard operability for search, filters, and download actions; visible focus states; AA contrast on all text (no low-contrast grey-on-black).
