# The geometry behind Sri Yantra Studio

## 1. The figure

Nine isosceles triangles, all symmetric about one vertical axis, inside a circle:
five point down (Śakti) and four point up (Śiva). Listed by the height of their
bases, top to bottom (names after Kavi Mahesh, 2023):

| # | Name    | Points | Apex rests on        | Base corners rest on |
|---|---------|--------|----------------------|----------------------|
| 1 | Ravi    | down   | middle of Shukra base | free                 |
| 2 | Chandra | down   | middle of Ketu base   | free                 |
| 3 | Kuja    | down   | the circle (bottom)   | the circle           |
| 4 | Budha   | down   | middle of Rahu base   | sides of Rahu        |
| 5 | Guru    | down   | middle of Shani base  | sides of Shukra      |
| 6 | Shukra  | up     | middle of Chandra base| sides of Chandra     |
| 7 | Shani   | up     | the circle (top)      | the circle           |
| 8 | Rahu    | up     | middle of Ravi base   | free                 |
| 9 | Ketu    | up     | middle of Kuja base   | free                 |

A drawing is a *true* Sri Yantra only if the lines meet three-at-a-time at the
18 **marma** points (nine mirror pairs):

| On the base of | Sides that must cross there        |
|----------------|------------------------------------|
| Chandra        | Ravi × Shani                       |
| Kuja           | Chandra × Shani, and Ravi × Rahu   |
| Budha          | Ravi × Shukra                      |
| Guru           | Ravi × Ketu                        |
| Shukra         | Budha × Ketu                       |
| Shani          | Kuja × Rahu, and Chandra × Ketu    |
| Rahu           | Kuja × Ketu                        |

## 2. Counting freedom

Each triangle is fixed by a base height `b`, an apex height `a` and `t = tan(half apex angle)`.
The apex heights are tied to other bases or the circle, leaving 9 + 9 = 18 unknowns.
Constraints: 2 (great triangles inscribed) + 9 (marma pairs) + 3 (corner touches) = 14.

**18 − 14 = 4 degrees of freedom.** This is Huet's theorem (*Sri Yantra Geometry*,
Theoretical Computer Science 281, 2002): the problem is under-determined with four real
parameters, which is exactly why so many different-looking correct yantras exist.

The app exposes the four as the base heights of **Ravi, Kuja, Shani and Ketu**
(fractions of the diameter, measured from the bottom).

## 3. The solver (`src/core/solver.ts`)

With unit circle, y up, and a trial value `s` for the Shukra base, everything follows
in closed form — each line below is one ruler-and-compass step:

```
tKuja    = √(1−bKuja²) / (bKuja+1)            tShani = √(1−bShani²) / (1−bShani)
tChandra = tShani(1−bKuja) / (bKuja−bKetu)
tRahu    = tKuja(bShani+1) / (bRavi−bShani)
tKetu    = tChandra(bShani−bKetu) / (bKuja−bShani)
bRahu    = (tKetu·bKuja − tKuja) / (tKuja+tKetu)
tRavi    = tRahu(bRavi−bKuja) / (bKuja−s)
bChandra = (tShani + tRavi·s) / (tRavi+tShani)
tShukra  = tChandra(s−bKetu) / (bChandra−s)
bGuru    = (tRavi·s + tKetu·bKuja) / (tRavi+tKetu)
tGuru    = tShukra(bChandra−bGuru) / (bGuru−bShani)
bBudha   = (tRavi·s + tShukra·bChandra) / (tRavi+tShukra)
tBudha   = tRahu(bRavi−bBudha) / (bBudha−bRahu)
residual = tKetu(bKuja−s) − tBudha(s−bRahu)        ← the last marma pair
```

`residual(s) = 0` is solved by bracketing and 80 bisection steps, i.e. to the last bit of
a 64-bit float. Seventeen of the eighteen crossings are exact by construction and the
last closes to about 10⁻¹⁶ of the radius — on a one-metre yantra that is far smaller
than an atom. Hand constructions (including good published ones) leave 0.02 % or more.

## 4. Checks against the literature (`src/core/geometry.test.ts`)

* **Huet's Classical Sri Yantra.** Feeding his four heights 0.887, 0.668, 0.398, 0.165
  reproduces his other five published values (0.769, 0.603, 0.551, 0.463, 0.265) to three decimals.
* **Kavi Mahesh's table** (Int. J. Sanskrit Research 9(6), 2023; ratios 8/9, 2/3, 2/5, 1/6):
  all base heights and widths agree; the paper fixes Shukra at 166.5 mm (of 360) and accepts a
  0.08 mm miss, the exact closure is 166.625 mm.
* **Lakshmīdhara's 48-part rule** (commentary on Saundaryalaharī 11; lines at
  6·12·17·20·23·27·30·36·42): made exact, the five dependent lines land at
  35.9, 28.5, 25.7, 21.9, 12.3 against the traditional 36, 28, 25, 21, 12.

## 5. The 43 triangles

The nine triangles cut the plane into 74 bounded faces (69 vertices, 142 edges).
The 43 triangles of tradition are precisely the faces covered by an **odd** number of
the nine: 1 → the ring of 14, 3 → the outer 10, 5 → the inner 10, 7 → the 8,
9 → the central triangle. The other 31 faces are the gaps between the rings.
The app verifies `[14, 10, 10, 8, 1]` and 18 marmas for every figure it draws.

## 6. Perfection goals

Two further criteria are often asked of an "optimal" yantra (sriyantraresearch.com):

* **Concentricity** — the bindu (incentre of the central triangle) at the centre of the circle;
* **Equilateral heart** — the central triangle equilateral (Ravi's apex angle = 60°).

Each uses up one degree of freedom. A damped Newton iteration on top of the exact solver
finds Shani (centred), Kuja (equilateral) or both. With both, and the top and bottom lines
at Huet's 0.887 and 0.165, the great upward triangle's base lands at 0.3819 of the diameter
— a base angle of 51.83°.

## 7. Triangles of any shape (`src/core/triangle.ts`)

A free triangle is stored the way it is laid out on the bench: a **base**, a **height**, and a
**skew** saying how far the apex stands off the middle of the base (0 = isosceles, ±1 = the apex
over a base corner, i.e. right-angled, beyond ±1 = obtuse). It can equally be stated by

* an apex angle α (isosceles): `height = (base/2) / tan(α/2)`;
* the two base angles L, R: `height = base / (cot L + cot R)`, apex foot at `height·cot L` from the left corner;
* three sides a (right), b (left), c (base): foot `d = (b² + c² − a²) / 2c`, `height = √(b² − d²)`.

One of five points — centroid, incentre, circumcentre, middle of the base, apex — is pinned to a
position in millimetres and is also the point the triangle turns about. Changing the pinned point
restates the position; the triangle itself does not move.

**Separating the Sri Yantra.** `sriAsTriangles` converts the solved figure into nine such triangles
(pinned at the middle of the base, skew 0). The test-suite checks that the separated figure has
exactly the same 27 line segments as the solved one, for every geometry preset.

Apex angles offered as presets, and why they are notable:

| Apex | Base angles | Where it comes from |
|------|-------------|---------------------|
| 36°  | 72°, 72°    | "Golden triangle": side / base = φ. The point of a pentagram. |
| 60°  | 60°, 60°    | Equilateral. |
| 76.35° | 51.83°    | Base angles of atan √φ. The Sri Yantra's great upward triangle comes close to this when the figure is centred with an equilateral heart (§6). |
| 90°  | 45°, 45°    | Half a square. |
| 108° | 36°, 36°    | "Golden gnomon": base / side = φ. |
| 120° | 30°, 30°    | A third of an equilateral triangle. |

A caution on the 51° angle: Kulaichev (1984) looked for whole-number ratios, simple fractions and
well-known constants in the exact figure and reported finding none. The app therefore *shows*
the base angles of the two great triangles and does not claim that any particular value is canonical.

## 8. Accuracy checks for any yantra (`src/core/analyse.ts`)

The Sri Yantra solver guarantees its own figure. Everything else — separated triangles,
hand-drawn shapes, figures placed by typed numbers — is checked by a general analysis of the
straight lines and circles of the drawing. With the first circle's radius as 1:

* **Exactly meeting** means within 10⁻⁷ (far below anything that can be engraved).
* **Nearly meeting** means within 0.005, about half a millimetre on a 300 mm yantra. Larger gaps
  are taken to be intended: several good Sri Yantras have real cells under 1 % of the radius across.

Three faults are reported, each with its position and the size of the gap in millimetres:

1. *Three lines leave a small gap.* Lines i, j, k whose three pairwise crossings fall within the
   tolerance of one another without coinciding — the failed marma point of a badly drawn Sri Yantra.
   Two pieces of the same infinite line count as one line.
2. *A corner stops just off a line.*
3. *A corner stops just off a circle* — a triangle meant to be inscribed that is not quite.

It also reports **symmetry** (left–right mirror, top–bottom mirror, and the largest n for which a
turn of 360°/n leaves the lines unchanged), a near-mirror error when the figure is almost but not
exactly symmetric, and the **directions** of all lines with the largest "round" angle of which
they are all multiples (a hexagram reads 0°, 60°, 120° on a 60° grid).

Every starting design in the app passes these checks with no fault (verified in the test-suite).

## 9. Exact rules behind the other yantras

* **Stars.** A star of n corners joined every k-th has corners 360°/n apart and a point angle of
  `180° − 360°·k/n`: hexagram {6/2} 60°, pentagram {5/2} 36°, eight-pointed {8/3} 45°, {8/2} 90°.
  The pentagram's inner pentagon has 1/φ² of the outer radius, which is how the "Five Golden
  Triangles" design reaches the circle exactly.
* **Lotuses.** n petals divide the circle into n equal parts of 360°/n. Petal counts in the tradition
  are 2, 4, 6, 8, 10, 12, 16 (the six body lotuses and their neighbours), then 24, 32, 64, 100, 1000.
* **Number squares.** A square is *magic* when every row, column and both diagonals have one sum.
  The app also reports when a square is *normal* (uses 1…n² once each) and *pandiagonal* (every
  broken diagonal has the sum too). The Chautisa (34) square carved at the Parshvanatha temple,
  Khajuraho, around the 12th century is both; it is counted among the three
  pandiagonal 4×4 squares. Nārāyaṇa Paṇḍita's *Gaṇita Kaumudī* (1356) treats the subject as
  *bhadra-gaṇita*, gives the knight's-move construction of all 384 pandiagonal 4×4 squares, and
  names making yantras as one purpose of the study. The nine planetary 3×3 squares are the 15
  square with 0…8 added to every cell.
* **Vāstu grids.** The ground plan divides a square into n×n equal *padas*. The two used most are
  the 8×8 Maṇḍūka (64, Brahmā holding the middle four) for temples and the 9×9 Paramaśāyika
  (81, Brahmā holding the middle nine).
* **The 81sts hypothesis.** One anonymous typescript (2012) holds that the nine apex angles of the
  Sri Yantra are whole multiples of 360°/81. The triangle table shows each apex angle in those
  units so that the claim can be tested against any geometry; the app does not assert it.

## Sources

* G. Huet, *Sri Yantra Geometry*, Theoretical Computer Science 281 (2002) 609–628.
* Kavi Mahesh, *Understanding the geometry of Sri Chakra*, Int. J. Sanskrit Research 9(6) (2023) 242–248.
* A. P. Kulaichev, *Sriyantra and its mathematical properties*, Indian J. History of Science 19(3) (1984).
* N. J. Bolton, D. N. G. Macleod, *The geometry of the Śrī-yantra*, Religion 7(1) (1977).
* C. S. Rao, *Sriyantra — a study of spherical and plane forms*, Indian J. History of Science 33(3) (1998).
* sriyantraresearch.com — "The Optimal Sri Yantra".
* A. Chiodo, *On the construction of the Śrī Yantra*, Comptes Rendus Mathématique 359(4) (2021) 377–397 — straightedge-and-compass construction; independently finds four degrees of freedom.
* sriyantrageometry.com, "The sources" — a tested index of the literature (source of the 81sts hypothesis and of the remark that Kulaichev found no simple constants).
* Wikipedia, "Magic square" (sections on India and on the Parshvanatha temple square), summarising Datta & Singh and Hayashi on Nārāyaṇa's *Gaṇita Kaumudī*, ch. 14.
