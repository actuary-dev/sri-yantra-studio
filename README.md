# Yantra Studio

Design yantras of any kind on a phone or tablet and export them for marble or metal
engraving (DXF, SVG) and large-format printing (PDF, PNG).

* **Centre:** any stack of figures — triangles, six-, five-, eight- and nine-pointed stars,
  any polygon or star, figures nested inside each other, circles, number squares, and the
  Sri Yantra's nine triangles solved exactly.
* **Triangles of any shape:** isosceles, right-angled or uneven, set by exact angles, by
  three sides or by base and height, placed anywhere in millimetres. The Sri Yantra can be
  separated into its nine triangles, each then editable by itself.
* **Accuracy:** a check that finds lines which nearly, but not exactly, meet in a point, and
  corners that stop just off a line or circle, with the gap in millimetres. Also symmetry,
  line directions, angle guide lines and a ruler that reads any length or angle on the drawing.
* **Rings:** circles, lotus rings, bead rings, mantra rings, the bhupura with its gates.
* **Text:** Sanskrit letters and numbers at every crossing, in every enclosed space, on
  every petal, or anywhere you tap — each with its own size and angle. One button hides it all.
* **Languages:** English and हिन्दी (with Sanskrit terms for the figures).

Live: https://actuary-dev.github.io/sri-yantra-studio/

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the "Network" address it prints (e.g. `http://192.168.1.20:5173`) on any phone
or tablet on the same Wi-Fi.

## Put it on a tablet for good

```bash
npm run build
```

Upload the `dist/` folder to any static web host (GitHub Pages, Netlify, Cloudflare
Pages). Open the address once in Chrome (Android) or Safari (iPad), then choose
**Add to Home screen**. It installs like an app and works without internet afterwards.

## Check the mathematics

```bash
npm test
```

The tests compare the solver with published coordinates (Huet 2002, Kavi Mahesh 2023)
and verify every starting design: 18 marma points, 43 triangles in rings of
14 · 10 · 10 · 8 · 1, crossing error below a millionth of a millimetre. They also check
that the Sri Yantra separated into nine free triangles is line-for-line the solved figure,
and that the general accuracy check finds no fault in any starting design.
See [docs/MATH.md](docs/MATH.md).

## Layout

| Folder         | What it holds                                                        |
|----------------|----------------------------------------------------------------------|
| `src/core`     | Sri Yantra solver, figures, free triangles, accuracy checks, scene builder |
| `src/outer`    | Circles, lotus rings, beads, mantra rings, bhupura gates             |
| `src/text`     | Sanskrit label sets, HarfBuzz shaping to outlines, transliteration   |
| `src/export`   | SVG, PDF, PNG, DXF writers at true millimetre size                   |
| `src/presets`  | The starting designs                                                 |
| `src/ui`       | The app (React)                                                      |

Fonts in `public/fonts` are under the SIL Open Font License (Tiro Devanagari Sanskrit,
Noto Sans Devanagari, Noto Serif Devanagari).
