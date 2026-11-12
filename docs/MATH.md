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

## Sources

* G. Huet, *Sri Yantra Geometry*, Theoretical Computer Science 281 (2002) 609–628.
* Kavi Mahesh, *Understanding the geometry of Sri Chakra*, Int. J. Sanskrit Research 9(6) (2023) 242–248.
* A. P. Kulaichev, *Sriyantra and its mathematical properties*, Indian J. History of Science 19(3) (1984).
* N. J. Bolton, D. N. G. Macleod, *The geometry of the Śrī-yantra*, Religion 7(1) (1977).
* C. S. Rao, *Sriyantra — a study of spherical and plane forms*, Indian J. History of Science 33(3) (1998).
* sriyantraresearch.com — "The Optimal Sri Yantra".
