# LogicLab

A full-stack logic expression solver built with Node.js, Express, and a browser frontend.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.
4. Open <http://localhost:3000>.

The frontend is served from `public/`. The server exposes `POST /api/solve` and `POST /api/compare`.

## Supported operators

`NOT` / `¬` / `!`, `AND` / `∧` / `&&`, `OR` / `∨` / `||`, `XOR` / `⊕`, `IMPLIES` / `→` / `->` / `=>`, and `IFF` / `↔` / `<->` / `<=>` / `=`. Constants: `TRUE`, `FALSE`, `1`, and `0`.
