"""Builds web/src/fonts/*.woff2 from the OFL TTFs (Hanken Grotesk, JetBrains Mono).

Usage: python3 web/scripts/subset-fonts.py <folder with the .ttf files>
Needs fonttools and brotli. The TTFs are in git history (web/src/fonts before the WOFF2 switch).

Keeps Latin (pt, es, en), punctuation, currency and card symbols. JetBrains Mono gets a narrow
U+202F/U+2009: pt-PT and es group thousands with a narrow no-break space ("12 345"), and a
monospace font would otherwise draw it a full cell wide (or fall back to another font).
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph

UNICODES = (
    'U+0000-024F,U+02C6,U+02DA,U+02DC,U+0300-0301,U+0303,U+0327,U+1E00-1EFF,U+2000-206F,'
    'U+20A0-20CF,U+2100-2122,U+2190-21FF,U+2212,U+2215,U+2260-2265,U+25A0-25FF,U+2660-2667,'
    'U+2713,U+FEFF,U+FFFD'
)


def narrow_space(font: TTFont) -> None:
    cmap = font.getBestCmap()
    if 0x202F in cmap:
        return
    name = 'uni202F'
    font.setGlyphOrder(font.getGlyphOrder() + [name])
    font['glyf'].glyphs[name] = Glyph()
    font['hmtx'].metrics[name] = (font['head'].unitsPerEm // 4, 0)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[0x202F] = name
            table.cmap[0x2009] = name
    font['maxp'].numGlyphs += 1


def main(src: str) -> None:
    out = os.path.join(os.path.dirname(__file__), '..', 'src', 'fonts')
    for f in sorted(os.listdir(src)):
        if not f.endswith('.ttf'):
            continue
        font = TTFont(os.path.join(src, f))
        if f.startswith('JetBrainsMono'):
            narrow_space(font)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=subset.parse_unicodes(UNICODES))
        sub.subset(font)
        dst = os.path.join(out, f[:-4] + '.woff2')
        font.flavor = 'woff2'
        font.save(dst)
        print(dst, os.path.getsize(dst))


if __name__ == '__main__':
    main(sys.argv[1])
