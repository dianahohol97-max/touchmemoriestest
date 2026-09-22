# Local fonts

These `.woff2` files replace `next/font/google` in four pages. They exist so the
build never has to reach fonts.googleapis.com.

The reason is a real failure, not caution. Deploy `c222c889` on 2026-09-22 went
ERROR with about twenty `module-not-found` lines inside
`[next]/internal/font/google/playfair_display_84809035.module.css`, one per
weight. That commit touched only `lib/` and `tests/`, and the next deploy built
the identical code green. Vercel does not block a failed build, it marks it
ERROR and leaves production on the previous one, so a network failure looks
exactly like a code failure and costs the same time to tell apart.

## What is in each file

Every family here is a variable font, which is what Google was serving too — the
css2 response returns the same file URL for every weight requested. One file
therefore covers the whole weight range, and the `weight: '100 900'` style
strings in the page code declare that range to the browser.

| File | Used by | Weights in the page code | Style |
|---|---|---|---|
| `Montserrat-Variable.woff2` | `app/layout.tsx` (`--font-montserrat`) | 700, 900 | normal |
| `OpenSans-Variable.woff2` | `app/layout.tsx` (`--font-open-sans`) | 400, 600 | normal |
| `PlayfairDisplay-Variable.woff2` | `app/[locale]/gallery/[token]/page.tsx` (`--font-gallery-serif`) | 400, 500, 600 | normal |
| `PlayfairDisplay-Italic-Variable.woff2` | same | 400, 500, 600 | italic |
| `CormorantGaramond-Variable.woff2` | gallery (`--font-gallery-cormorant`), `app/wedding/[slug]/page.tsx` and `app/wedding/album/[token]/page.tsx` (`--font-wedding-display`) | 400, 500, 600 | normal |
| `CormorantGaramond-Italic-Variable.woff2` | gallery only | 400, 500, 600 | italic |
| `Caveat-Variable.woff2` | gallery (`--font-gallery-caveat`) | 400, 600 | normal |

Each file is subset to the union of Google's own `latin` and `cyrillic`
unicode-ranges — exactly the two subsets the pages were declaring before.

One thing that union does **not** contain is the hryvnia sign `₴` (U+20B4):
Google files it under `cyrillic-ext`, which was never requested, so `₴` was
already rendering in a system fallback font before this change and still does.
Adding `cyrillic-ext` would fix that, but it is a visible change to every price
on the site, so it needs a deliberate decision rather than a silent widening.

## Rebuilding

Only needed when a weight, a style or a subset changes in the page code:

```bash
pip install "fonttools[woff]" brotli
python3 scripts/build-local-fonts.py
```

The script prints the weight axis of every file it writes; those numbers are
what the `weight:` strings in the page code have to match.

## Licence

All five families are SIL Open Font License 1.1. The licence texts are the
`OFL-*.txt` files next to the fonts, taken from github.com/google/fonts, which
is also where the upstream variable TTFs come from.
