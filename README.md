# Yantra Studio

Design yantras of any kind on a phone or tablet and export them for marble or metal
engraving (DXF, SVG) and large-format printing (PDF, PNG).

* **Centre:** any stack of figures — triangles, six-, five-, eight- and nine-pointed stars,
  any polygon or star, figures nested inside each other, circles, number squares, and the
  Sri Yantra's nine triangles solved exactly.
* **Rings:** circles, lotus rings, bead rings, mantra rings, the bhupura with its gates.
* **Text:** Sanskrit letters and numbers at every crossing, in every enclosed space, on
  every petal, or anywhere you tap — each with its own size and angle. One button hides it all.

Live: https://radical-anarchist.github.io/sri-yantra-studio/

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
14 · 10 · 10 · 8 · 1, crossing error below a millionth of a millimetre.
See [docs/MATH.md](docs/MATH.md).

## Layout

| Folder         | What it holds                                                        |
|----------------|----------------------------------------------------------------------|
| `src/core`     | Sri Yantra solver, figures, planar arrangement, scene builder, types |
| `src/outer`    | Circles, lotus rings, beads, mantra rings, bhupura gates             |
| `src/text`     | Sanskrit label sets, HarfBuzz shaping to outlines, transliteration   |
| `src/export`   | SVG, PDF, PNG, DXF writers at true millimetre size                   |
| `src/presets`  | The starting designs                                                 |
| `src/ui`       | The app (React)                                                      |

Fonts in `public/fonts` are under the SIL Open Font License (Tiro Devanagari Sanskrit,
Noto Sans Devanagari, Noto Serif Devanagari).
