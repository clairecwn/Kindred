"""Three values of a colour in clean bands, for the Kingdom kit: the same look the item models use (assets/items).
shade() gives the light cap and the dark foot of a colour; <name>_lt and <name>_dk name them as materials; tn() used as
a part's material paints the part in bands; TB is the builder that understands tn().
Import after kk (it wraps the colour lookup kk installed) and reload it on every pass run."""
import bpy, bmesh, colorsys
import gk, gv
from gk import B, lin, srgb
_DONE = set()

def shade(hexcol, kind):
    """Lighter and a little towards yellow, or darker and a little towards violet; both stay saturated."""
    h, s, v = colorsys.rgb_to_hsv(*srgb(hexcol))
    def toward(h, t, k):
        d = ((t - h + 0.5) % 1.0) - 0.5
        return (h + max(-k, min(k, d))) % 1.0
    if kind == "lt": h, s, v = toward(h, 50 / 360, 0.035), s * 0.8, v + (1 - v) * 0.5
    else: h, s, v = toward(h, 265 / 360, 0.02), min(1.0, s * 1.06 + 0.02), v * 0.8
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))

def hex_of(m):
    if m.get("ki_hex"): return m["ki_hex"]
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return "#%02X%02X%02X" % tuple(round(max(0.0, min(1.0, f(m.diffuse_color[i]))) * 255) for i in range(3))

def paint(m, hexcol):
    c = lin(hexcol); m.diffuse_color = (*c, 1); m["ki_hex"] = hexcol
    p = m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
    if p: p.inputs["Base Color"].default_value = (*c, 1)

def derive(m, kind):
    """The light or dark step of a material, as <its name>_lt / _dk."""
    n = m.name + "_" + kind; d = bpy.data.materials.get(n)
    if d is None: d = m.copy(); d.name = n
    if n not in _DONE: paint(d, shade(hex_of(m), kind)); _DONE.add(n)
    return d

import kk
_plain = kk.M                    # not gk.M: after a reload that is this module's own wrapper
def M2(name):
    if name.endswith(("_lt", "_dk")) and not name.endswith(("trunk_light", "leaf_light")):
        return derive(_plain(name[:-3]), name[-2:])
    return _plain(name)
gk.M = M2

def V(channel, colour, kind=None):
    """A part of a decor piece the player can repaint. channel is "A" (main) or "B" (accent); colour is the palette name
    it shows by default; kind "lt" or "dk" is its light or dark step. The game repaints every KV_A_* and KV_B_* material
    of the one piece it is drawing and keeps the steps; nothing else is touched. Same rule as the item models."""
    n = "KV_%s_%s" % (channel, colour); m = bpy.data.materials.get(n)
    if m is None:
        src = _plain(colour); m = src.copy(); m.name = n; m["ki_hex"] = hex_of(src)
    return derive(m, kind) if kind else m

class Tone:
    def __init__(s, main, lo, hi, tilt):
        s.main = M2(main) if isinstance(main, str) else main; s.lo, s.hi, s.tilt = lo, hi, tilt
def tn(main, lo=0.24, hi=0.7, tilt=0.0):
    """As a part's material: dark below `lo`, light above `hi` (shares of the part's height; None leaves one out).
    The bands are level: on the flat faces of a building a leaning band reads as a diagonal stripe. Pass tilt=0.3 for
    round things."""
    return Tone(main, lo, hi, tilt)

class TB(B):
    def _add(s, t, m=None, mtx=None):
        if not isinstance(m, Tone): return super()._add(t, m, mtx)
        if mtx is not None:
            bmesh.ops.transform(t, matrix=mtx, verts=t.verts[:])
            if mtx.to_3x3().determinant() < 0: bmesh.ops.reverse_faces(t, faces=t.faces[:])
        i0 = s.mi(m.main)
        for f in t.faces: f.material_index = i0
        cs = [v.co for v in t.verts]; z0 = min(c.z for c in cs); z1 = max(c.z for c in cs); H = max(z1 - z0, 1e-4)
        cx = sum(c.x for c in cs) / len(cs); cy = sum(c.y for c in cs) / len(cs)
        dx = max(max(c.x for c in cs) - min(c.x for c in cs), 1e-3); dy = max(max(c.y for c in cs) - min(c.y for c in cs), 1e-3)
        no = (m.tilt * 0.6 * min(1.0, H / dx), -m.tilt * min(1.0, H / dy), 1)
        if m.lo is not None: gv.band(t, (cx, cy, z0 + H * m.lo), no, s.mi(derive(m.main, "dk")), above=False)
        if m.hi is not None: gv.band(t, (cx, cy, z0 + H * m.hi), no, s.mi(derive(m.main, "lt")), above=True)
        super()._add(t, None, None)
