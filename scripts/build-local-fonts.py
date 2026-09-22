"""Rebuild the local .woff2 files in app/fonts/ that replace next/font/google.

Why this exists: `next/font/google` downloads the font files from
fonts.googleapis.com DURING THE BUILD. On 2026-09-22 that call failed once and
Vercel marked the deploy ERROR with a module-not-found inside
`[next]/internal/font/google/playfair_display_*.module.css`, on a commit that
touched neither fonts nor the pages that load them. The same code deployed
green on the next attempt. Local files remove the network from the build.

What it produces: one variable .woff2 per family (plus a separate italic file
where the family has a real italic), subset to EXACTLY the union of Google's
own `latin` + `cyrillic` unicode-ranges — the two subsets the pages were asking
for. The ranges are read from the live css2 response rather than hardcoded, so
a rerun follows Google if they ever change.

The sources are the upstream variable TTFs from github.com/google/fonts, all
OFL — the licences sit next to the fonts in app/fonts/OFL-*.txt.

Run it only when a weight, a style or a subset changes in the page code:

    pip install "fonttools[woff]" brotli
    python3 scripts/build-local-fonts.py

It rewrites app/fonts/*.woff2 in place and prints the weight axis of each file,
which is what the `weight: '100 900'` strings in the page code must match.
"""
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "app", "fonts")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# (css2 query, upstream variable TTF, output basename, axes to pin before subsetting)
FAMILIES = [
    ("Montserrat:wght@700",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
     "Montserrat-Variable", {}),
    ("Open+Sans:wght@400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf",
     # Open Sans upstream also carries a width axis; Google serves it pinned to
     # 100 (normal) and nothing in the app touches font-stretch.
     "OpenSans-Variable", {"wdth": 100}),
    ("Playfair+Display:wght@400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
     "PlayfairDisplay-Variable", {}),
    ("Playfair+Display:ital,wght@1,400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf",
     "PlayfairDisplay-Italic-Variable", {}),
    ("Cormorant+Garamond:wght@400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
     "CormorantGaramond-Variable", {}),
    ("Cormorant+Garamond:ital,wght@1,400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf",
     "CormorantGaramond-Italic-Variable", {}),
    ("Caveat:wght@400",
     "https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf",
     "Caveat-Variable", {}),
]

# The two subsets the pages declared before the move to local files. Adding
# `cyrillic-ext` here would also pull in the hryvnia sign U+20B4, which Google
# puts in that subset — that is a visible change, not a no-op, so it stays out
# until it is asked for deliberately.
SUBSETS = ("latin", "cyrillic")


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=120).read()


def google_unicode_ranges(query: str) -> dict:
    css = fetch(f"https://fonts.googleapis.com/css2?family={query}&display=swap").decode()
    ranges = {}
    for name, block in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        found = re.search(r"unicode-range:\s*([^;]+);", block)
        if found:
            ranges[name] = found.group(1).strip()
    return ranges


def main() -> None:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for query, ttf_url, base, pin in FAMILIES:
            ranges = google_unicode_ranges(query)
            codepoints = []
            for subset in SUBSETS:
                if subset not in ranges:
                    sys.exit(f"{base}: google css2 has no {subset} subset")
                codepoints += [p.strip().replace("U+", "") for p in ranges[subset].split(",")]

            src = os.path.join(tmp, base + ".ttf")
            with open(src, "wb") as handle:
                handle.write(fetch(ttf_url))

            if pin:
                pinned = instancer.instantiateVariableFont(TTFont(src), pin, updateFontNames=False)
                src = os.path.join(tmp, base + ".pinned.ttf")
                pinned.save(src)

            dst = os.path.join(OUT, base + ".woff2")
            subprocess.run([
                sys.executable, "-m", "fontTools.subset", src,
                "--unicodes=" + ",".join(codepoints),
                "--layout-features=*",
                "--flavor=woff2",
                "--no-hinting",
                "--desubroutinize",
                "--name-IDs=*",
                "--output-file=" + dst,
            ], check=True)

            built = TTFont(dst)
            axes = {a.axisTag: (a.minValue, a.maxValue) for a in built["fvar"].axes} if "fvar" in built else {}
            print(f"{base + '.woff2':42} {os.path.getsize(dst) // 1024:4} KB  {axes}")


if __name__ == "__main__":
    main()
