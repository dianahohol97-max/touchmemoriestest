"""Rebuild public/editor-fonts/ — the local copy of the 98 constructor fonts.

Why this exists: the print layout used to pull its fonts from the network at
render time. `/print` injected `GOOGLE_FONTS_URL` as a plain <link>, and the
headless Chromium on Railway fetched fonts.googleapis.com and fonts.gstatic.com
itself. A failed fetch there is completely silent — `document.fonts.ready`
resolves either way — so the screenshot came out in a fallback face and the
book went to print in a typeface the customer never chose. Measured live in the
same Chromium the service runs: with the stylesheet blocked, every face is
missing and `document.fonts.check()` still answers `true`.

What it produces: byte-for-byte the same .woff2 files Google is serving today,
next to a `fonts.css` whose `@font-face` blocks carry the SAME descriptors —
same family, same `font-weight: 400`, same `font-style: normal`, same
`unicode-range`, only the `src` rewritten to our own path. Identical files plus
identical descriptors is what makes this change invisible: nothing about the
rendering can differ, because nothing about the input differs.

Two consequences of copying Google's own output rather than subsetting the
upstream TTFs (which is what scripts/build-local-fonts.py does for the five
site fonts):

  * The weight stays 400 and only 400. css2 answers a bare `family=Name` with a
    single 400 face even for variable families, so bold and italic in the book
    are SYNTHESISED by the browser today. Shipping a real 700 instance would
    change how every bold caption looks, which is the one thing this must not
    do.
  * Every subset Google offers is copied, not just latin and cyrillic. A Polish
    ł, a Romanian ș, a Greek letter or the ₴ each live in their own subset, and
    dropping one would silently move those characters to a fallback — the very
    defect this change exists to remove.

Run it when FONT_DATA in lib/editor/constants.ts changes:

    python3 scripts/build-editor-fonts.py

`tests/editor-fonts-pack.test.ts` fails the build when a family in FONT_DATA
has no files here, so a font added to the picker cannot reach production
without its files. That test is the mechanism for new fonts — not a reminder in
a doc.

Licences: every family in FONT_DATA is served by Google Fonts under the SIL
Open Font License 1.1 or the Apache License 2.0; the manifest records the css2
query each file came from, which is the provenance the licences require.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONSTANTS = os.path.join(REPO, "lib", "editor", "constants.ts")
OUT = os.path.join(REPO, "public", "editor-fonts")
FILES = os.path.join(OUT, "files")

# css2 varies its answer by User-Agent: an old UA gets .ttf, a modern Chrome
# gets .woff2. The render service runs Chromium, so ask as Chromium does —
# otherwise we would ship files the browser never asked for.
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Families css2 answers with «400: Font family not found». Google silently drops
# such a name from a multi-family request rather than failing the whole answer,
# so it looks like nothing is wrong until someone picks the font and gets a
# fallback — that is how «Kyiv Type Sans» sat in the picker unnoticed until
# 23.09.2026, when it was dropped from FONT_DATA because no saved layout used it.
#
# Empty on purpose, and kept because it was needed once. When css2 refuses a
# name again, main() stops and says to add it here; the name then stays in
# FONT_DATA so layouts saved with it still open, but is asked of neither Google
# nor the pack. Mirror it in FONTS_NOT_ON_GOOGLE in lib/editor/constants.ts.
NOT_ON_GOOGLE: set[str] = set()

# One request per chunk. css2 takes many families at once and the answer is
# identical to the concatenation of the parts, but a single 1.8 KB URL for all
# 98 is close enough to proxy limits to be worth splitting.
CHUNK = 20


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def font_names() -> list[str]:
    """Read FONT_DATA out of constants.ts — one source of truth, not two."""
    src = open(CONSTANTS, encoding="utf-8").read()
    m = re.search(r"export const FONT_DATA[^\[]*\[(.*?)\n\];", src, re.S)
    if not m:
        sys.exit("FONT_DATA not found in lib/editor/constants.ts")
    names = re.findall(r"\{\s*name:\s*'([^']+)'", m.group(1))
    if not names:
        sys.exit("FONT_DATA parsed but empty")
    return names


def local_name(url: str) -> str:
    """Stable file name from the gstatic path: family/version/hash.woff2.

    Keeping Google's own version segment ('v22') in the name means a rerun that
    picks up a new version writes a NEW file instead of overwriting the old one,
    so a layout rendered before and after the rerun cannot silently change face
    mid-flight — the old file is still there until someone removes it.
    """
    tail = url.split("/s/", 1)[1] if "/s/" in url else url.rsplit("/", 1)[-1]
    return re.sub(r"[^A-Za-z0-9_.-]", "-", tail)


def main() -> None:
    names = font_names()
    print(f"FONT_DATA: {len(names)} families")

    wanted = [n for n in names if n not in NOT_ON_GOOGLE]
    css_parts: list[str] = []
    for i in range(0, len(wanted), CHUNK):
        fam = "&".join("family=" + n.replace(" ", "+") for n in wanted[i:i + CHUNK])
        url = f"https://fonts.googleapis.com/css2?{fam}&display=swap"
        try:
            css_parts.append(fetch(url).decode("utf-8"))
        except urllib.error.HTTPError as e:
            sys.exit(
                f"css2 refused a chunk with HTTP {e.code}. One of these names is "
                f"not a Google family: {wanted[i:i + CHUNK]}"
            )
    css = "\n".join(css_parts)

    # Each face in the answer is preceded by a /* subset */ comment. The subset
    # name is not used for matching (unicode-range is), it goes into the output
    # so a human reading fonts.css sees the same structure Google shows.
    blocks = re.findall(r"/\* ([a-z0-9\-\[\]]+) \*/\s*@font-face \{(.*?)\}", css, re.S)
    if not blocks:
        sys.exit("css2 answered, but no @font-face blocks were parsed")

    faces = []
    for subset, body in blocks:
        def field(key: str) -> str:
            m = re.search(rf"{key}:\s*([^;]+);", body)
            return m.group(1).strip() if m else ""
        src = re.search(r"url\((https://[^)]+)\)", body)
        if not src:
            sys.exit(f"@font-face without a url(): {body[:120]}")
        faces.append({
            "family": field("font-family").strip("'\""),
            "style": field("font-style") or "normal",
            "weight": field("font-weight") or "400",
            "unicodeRange": field("unicode-range"),
            "subset": subset,
            "remote": src.group(1),
            "file": local_name(src.group(1)),
        })

    served = {f["family"] for f in faces}
    missing = [n for n in wanted if n not in served]
    if missing:
        sys.exit(
            "css2 returned nothing for these families — add them to NOT_ON_GOOGLE "
            f"or fix the spelling: {missing}"
        )

    # Descriptors other than weight 400 / style normal would mean css2 changed
    # what a bare family request answers, and the printed bold would change with
    # it. Stop rather than ship that quietly.
    odd = {(f["weight"], f["style"]) for f in faces} - {("400", "normal")}
    if odd:
        sys.exit(
            f"css2 now answers a bare family with {sorted(odd)} as well as 400/normal. "
            "Shipping those would change how synthesised bold looks in every book — "
            "decide deliberately before rerunning."
        )

    os.makedirs(FILES, exist_ok=True)
    unique = {f["file"]: f["remote"] for f in faces}
    print(f"{len(faces)} faces over {len(served)} families, {len(unique)} distinct files")

    def download(item):
        name, url = item
        path = os.path.join(FILES, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return 0
        data = fetch(url)
        with open(path, "wb") as fh:
            fh.write(data)
        return len(data)

    with ThreadPoolExecutor(12) as pool:
        written = sum(pool.map(download, unique.items()))
    total = sum(os.path.getsize(os.path.join(FILES, n)) for n in unique)
    print(f"downloaded {written / 1024:.0f} KB, pack is {total / 1024 / 1024:.2f} MB")

    faces.sort(key=lambda f: (f["family"], f["subset"]))
    lines = [
        "/* GENERATED by scripts/build-editor-fonts.py — do not edit by hand.",
        " *",
        " * The same .woff2 files Google Fonts serves for these families, with the",
        " * same @font-face descriptors, served from our own origin. Print renders",
        " * read this instead of fonts.googleapis.com so a network failure cannot",
        " * substitute the typeface a customer chose. Weight is 400 everywhere",
        " * because that is all a bare css2 family request returns — bold and",
        " * italic are synthesised by the browser, exactly as before.",
        " */",
        "",
    ]
    for f in faces:
        lines += [
            f"/* {f['subset']} */",
            "@font-face {",
            f"  font-family: '{f['family']}';",
            f"  font-style: {f['style']};",
            f"  font-weight: {f['weight']};",
            # swap, like Google's answer: the fallback is painted first and
            # replaced when the file lands. The print sentinel is what refuses
            # to screenshot before the replacement happened.
            "  font-display: swap;",
            f"  src: url(/editor-fonts/files/{f['file']}) format('woff2');",
        ]
        if f["unicodeRange"]:
            lines.append(f"  unicode-range: {f['unicodeRange']};")
        lines += ["}", ""]
    with open(os.path.join(OUT, "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    manifest = {
        "note": "GENERATED by scripts/build-editor-fonts.py — read by tests/editor-fonts-pack.test.ts",
        "families": {},
        "notOnGoogle": sorted(NOT_ON_GOOGLE),
        "bytes": total,
    }
    for f in faces:
        manifest["families"].setdefault(f["family"], []).append({
            "subset": f["subset"],
            "file": f["file"],
            "unicodeRange": f["unicodeRange"],
        })
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")

    # Які родини справді несуть кирилицю — ФАКТ із файлів, не політика підбірки.
    #
    # `FONT_DATA[].cyr` відповідає на інше питання: чи пропонувати шрифт у
    # підбірці. Ці дві речі розійшлися і мовчки: Lato і Poppins стояли з
    # `cyr: true`, хоча кириличної підмножини для них Google не віддає ні тут,
    # ні в апстрімі, і український текст у них малювався системним шрифтом.
    # Тепер відповідь на «чи є в цьому файлі кирилиця» береться з самих файлів,
    # а `cyr` лишається тим, чим був, і тест пиняє, щоб `cyr: true` без
    # кирилиці більше не траплявся.
    with_cyrillic = sorted({f["family"] for f in faces if f["subset"] == "cyrillic"})
    in_pack = sorted(served)
    scripts_ts = os.path.join(REPO, "lib", "editor", "font-scripts.ts")
    with open(scripts_ts, "w", encoding="utf-8") as fh:
        fh.write(
            "/* ЗГЕНЕРОВАНО scripts/build-editor-fonts.py — руками не правити.\n"
            " *\n"
            " * Які з наших шрифтів справді мають кириличні гліфи. Це факт про\n"
            " * файли в public/editor-fonts/, а не про те, що пропонує підбірка:\n"
            " * FONT_DATA[].cyr відповідає на друге питання, і саме тому вони вже\n"
            " * розходилися. Українським текстом у родині, якої тут немає, друк\n"
            " * вийде системним шрифтом — про це попереджає перелік перед\n"
            " * оформленням і перевірка макетів в адмінці.\n"
            " */\n"
            "export const FONTS_WITH_CYRILLIC: ReadonlySet<string> = new Set([\n"
            + "".join(f"  '{name}',\n" for name in with_cyrillic)
            + "]);\n"
            "\n"
            "/**\n"
            " * Усі родини, файли яких ми віддаємо самі.\n"
            " *\n"
            " * Родина поза цим переліком друкується системним шрифтом, хай би що\n"
            " * стояло в макеті: у контейнері Railway немає ні Georgia, ні будь-чого\n"
            " * іншого з Windows. Це не те саме, що «немає кирилиці» — там ідеться\n"
            " * про частину тексту, а тут про весь.\n"
            " */\n"
            "export const FONTS_IN_PACK: ReadonlySet<string> = new Set([\n"
            + "".join(f"  '{name}',\n" for name in in_pack)
            + "]);\n"
        )

    print(f"wrote {OUT}/fonts.css, manifest.json and lib/editor/font-scripts.ts")
    print(f"з кирилицею: {len(with_cyrillic)} родин із {len(served)}")
    if NOT_ON_GOOGLE:
        print(f"not served by Google, left out on purpose: {sorted(NOT_ON_GOOGLE)}")


if __name__ == "__main__":
    main()
