# CSS Color Mix Finder

A browser tool to find the perfect `color-mix()` blend color that reproduces your hover and active design token states.

## What it does

Given a **base color** and target **hover / active** colors, the tool reverse-engineers the blend color and percentage to use in a CSS `color-mix()` expression so the result visually matches your targets as closely as possible.

```css
/* Example output */
background-color: color-mix(in oklab, #e0001a 100%, #500001 33%);
```

## Features

- Finds the optimal blend color and percentage for both hover and active states simultaneously
- Supports **oklab**, **lab**, and **sRGB** color spaces — or let it pick the best one automatically
- Shows **Delta E** perceptual color difference between result and target
- Displays live `color-mix()` CSS snippets with one-click copy
- **History** — last 10 calculations persisted in localStorage, restored on reload
- **Pin** history entries to protect them from being evicted
- Light / dark mode toggle

## Usage

```bash
npm install
npm start   # opens http://127.0.0.1:8080
```

No build step — vanilla HTML/CSS/JS served by live-server.

## License

GPL v3 — free to use and modify, but any distribution must remain open source.


