"""Item parts: the shapes many items are made from, each drawn in the item look (fat, banded in three values, cream
trim). Sizes are in metres. Parts stand on z and face -Y unless they say otherwise."""
from ii import *

def tri(col):
    """(dark, main, light) of a palette name or of a recolourable material."""
    if isinstance(col, str): return col + "_dk", col, col + "_lt"
    return derive(col, "dk"), col, derive(col, "lt")

def pot(b, R=0.2, H=0.26, col="pot", fill="soil", loc=(0, 0, 0), seg=20):
    """A pot with a thick pale rim. R is the rim's radius. Returns the height of the soil."""
    d, m, l = tri(col); k, h = R / 0.245, H / 0.31
    prof = [(0, 0), (0.14, 0), (0.16, 0.02), (0.2, 0.2), (0.2, 0.215), (0.235, 0.215), (0.245, 0.24), (0.245, 0.29), (0.235, 0.31), (0.2, 0.31), (0.195, 0.27), (0, 0.27)]
    b.lathe([(r * k, z * h) for r, z in prof], loc, mats=[d, d, m, d, d, l, l, l, l, d, fill], seg=seg)
    return loc[2] + 0.27 * h

def bowl(b, R, H, col, inside="cream", fill=None, loc=(0, 0, 0), level=0.8, seg=24):
    """A round bowl on a foot. Returns the height of what is in it."""
    d, m, l = tri(col)
    b.lathe([(0, 0), (R * 0.45, 0), (R * 0.5, H * 0.07), (R * 0.8, H * 0.4), (R * 0.97, H * 0.8), (R, H * 0.96), (R * 0.96, H), (R * 0.9, H * 0.96), (R * 0.86, H * level), (0, H * level)],
            loc, mats=[d, d, m, m, l, "cream", "cream", inside, fill or inside], seg=seg)
    return loc[2] + H * level

def tin(b, R, H, col, lid="cream", loc=(0, 0, 0), seg=20):
    """A round tin with a lid that overlaps the body."""
    d, m, l = tri(col); ld, lm, ll = tri(lid)
    b.lathe([(0, 0), (R * 0.93, 0), (R, 0.02), (R, H * 0.8), (R * 1.05, H * 0.8), (R * 1.05, H * 0.95), (R * 0.97, H), (0, H)], loc, mats=[d, d, m, ld, lm, ll, ll], seg=seg)

def band(b, r, z0, z1, m, loc=(0, 0, 0), proud=0.005, seg=20):
    """A label or stripe wrapped round a round body of radius r."""
    b.lathe([(r - 0.004, z0), (r + proud, z0 + 0.005), (r + proud, z1 - 0.005), (r - 0.004, z1)], loc, m=m, seg=seg, cap=False)

def book(b, cover, w=0.3, d=0.09, h=0.38, emblem=None, strap=None, mark=None):
    """A closed book standing upright: cover to the front, spine to the left, pages showing at the top and the right."""
    dk, m, lt = tri(cover)
    b.box((w - 0.03, d - 0.026, h - 0.03), (0.008, 0, h / 2), tn("paper", 0.2, None))
    b.box((w, 0.016, h), (0, -d / 2 + 0.008, h / 2), tn(m, 0.16, 0.86), r=0.007, seg=1)
    b.box((w, 0.016, h), (0, d / 2 - 0.008, h / 2), dk, r=0.007, seg=1)
    b.box((0.034, d + 0.008, h), (-w / 2 + 0.01, 0, h / 2), dk, r=0.014)        # a little thicker than the covers, so the spine is not in their plane
    for z in (0.16, 0.84): b.box((0.046, d + 0.018, 0.012), (-w / 2 + 0.01, 0, h * z), "gold")
    if strap: b.box((0.03, d + 0.01, h + 0.01), (w / 2 - 0.06, 0, h / 2), strap, r=0.004, seg=1)
    if mark: b.box((0.032, 0.01, 0.1), (w / 2 - 0.1, -d / 2 - 0.008, h - 0.04), mark)      # a ribbon marker folded over the cover
    if emblem: emblem(b, -d / 2, h * 0.56)

def checker_slab(b, nx, ny, w, d, z0, z1, fm):
    """A flat slab whose top is nx by ny squares; fm(i, j) names each square's colour. The sides take the colour of the
    square above them. One closed mesh, so nothing lies in the same plane as anything else."""
    t = bmesh.new(); sx, sy = w / nx, d / ny
    V_ = [[t.verts.new((-w / 2 + i * sx, -d / 2 + j * sy, z1)) for j in range(ny + 1)] for i in range(nx + 1)]
    L_ = {}
    def low(i, j):
        if (i, j) not in L_: L_[(i, j)] = t.verts.new((-w / 2 + i * sx, -d / 2 + j * sy, z0))
        return L_[(i, j)]
    for i in range(nx):
        for j in range(ny):
            k = b.mi(fm(i, j)); f = t.faces.new((V_[i][j], V_[i + 1][j], V_[i + 1][j + 1], V_[i][j + 1])); f.material_index = k
            if j == 0: t.faces.new((low(i, 0), low(i + 1, 0), V_[i + 1][0], V_[i][0])).material_index = k
            if j == ny - 1: t.faces.new((V_[i][ny], V_[i + 1][ny], low(i + 1, ny), low(i, ny))).material_index = k
            if i == 0: t.faces.new((low(0, j + 1), low(0, j), V_[0][j], V_[0][j + 1])).material_index = k
            if i == nx - 1: t.faces.new((low(nx, j), low(nx, j + 1), V_[nx][j + 1], V_[nx][j])).material_index = k
    t.faces.new([low(i, 0) for i in range(nx + 1)][::-1] + [low(0, j) for j in range(1, ny + 1)] + [low(i, ny) for i in range(1, nx + 1)] + [low(nx, j) for j in range(ny - 1, 0, -1)])
    b._add(t, None, None)

_BL = {}
def bloom_mesh(n, petal, core):
    """The Grove's bloom with few enough triangles to use several times on one item: radius 1 in the XZ plane, front -Y."""
    k = (n, petal, core)
    if k not in _BL:
        b = B()
        for i in range(n):
            a = tau * i / n; b.ball(1.0, (0.62 * sin(a), 0, 0.62 * cos(a)), petal, sc=(0.3, 0.09, 0.42), u=7, v=4, rot=(0, a, 0))
        b.ball(0.3, (0, -0.06, 0), core, sc=(1, 0.45, 1), u=9, v=5)
        _BL[k] = b.data("_ip_bloom_%s_%s_%d" % (petal, core, n))
    return _BL[k]

def bloom_at(b, loc, R, petal, core, n=8, face="-y", thick=0.1):
    """The Grove's bloom as a relief of radius R. face: "-y" for a front, "+z" for a top."""
    rot = {"-y": (0, 0, 0), "+z": (-pi / 2, 0, 0), "+x": (0, 0, pi / 2), "-x": (0, 0, -pi / 2), "+y": (0, 0, pi)}[face]
    b.mesh(bloom_mesh(n, petal, core), None, mtx=xf(loc, rot) @ Matrix.Diagonal((R, R * thick / 0.09, R, 1)))

def heart_at(b, y, z, R, m, x=0.0, depth=0.02):
    b.prism(heart_pts(R), depth, m, mtx=XZ(y - depth * 0.6, x, z), r=min(0.005, depth * 0.3))

def leaves_at(b, y, z, s, m="cream", x=0.0):
    """Two leaves in a V as a flat relief on a front face."""
    for sg in (-1, 1): b.ball(1.0, (x + sg * s * 0.36, y, z + s * 0.12), m, sc=(s * 0.42, 0.012, s * 0.2), u=10, v=6, rot=(0, -sg * 0.6, 0))
    b.box((s * 0.1, 0.014, s * 0.5), (x, y, z - s * 0.2), m)

def stem_flower(b, base, h, petal, core="yellow", R=0.06, lean=(0, 0), n=6, leaf_m="leaf_light"):
    """A flower on a stem with one leaf, the head tipped a little to the front."""
    x, y, z = base; tx, ty = x + lean[0], y + lean[1]
    b.tube([(x, y, z), ((x + tx) / 2 + 0.01, (y + ty) / 2, z + h * 0.55), (tx, ty, z + h)], 0.012, "leaf_dark", seg=6)
    leaf(b, ((x + tx) / 2, (y + ty) / 2, z + h * 0.35), R * 1.5, leaf_m, 0.4 + x * 7, 0.6)
    b.mesh(bloom_mesh(n, petal, core), None, mtx=xf((tx, ty - 0.012, z + h), (-0.45, 0, 0)) @ Matrix.Diagonal((R, R * 1.6, R, 1)))

def shoe(b, upper, sole="cream", L=0.44, W=0.3, kind="sneaker", trim="cream"):
    """One shoe, toe to +X, sized to the character's foot (0.27 wide, 0.38 long). kind: sneaker, boot, ankle, rain, sandal.
    Built as a toy shoe is drawn (Animal Crossing, Mario's own boots): a foot-shaped sole, wider at the toe, a round toe,
    a puffed vamp and a round heel, and for a boot a round shaft with its opening dark inside. No flat sides."""
    d, m, l = tri(upper); x0, x1 = -L / 2, L / 2
    foot = [(L / 2 * cos(tau * i / 28), W / 2 * (0.84 + 0.16 * cos(tau * i / 28)) * sin(tau * i / 28)) for i in range(28)]
    b.prism(foot, 0.055, tn(sole, 0.3, None), r=0.02)
    if kind == "sandal":
        for xa in (0.1, -0.06): b.tube([(xa, -W / 2 + 0.03, 0.04), (xa, -W * 0.3, 0.13), (xa, 0, 0.155), (xa, W * 0.3, 0.13), (xa, W / 2 - 0.03, 0.04)], 0.032, m, seg=8)
        b.tube([(-0.06, -W * 0.3, 0.13), (-0.19, -W * 0.33, 0.1), (-0.21, 0, 0.09), (-0.19, W * 0.33, 0.1), (-0.06, W * 0.3, 0.13)], 0.022, d, seg=8)
        return
    b.ball(1.0, (x1 - 0.115, 0, 0.1), tn(m, 0.3, 0.75), sc=(0.115, W / 2 - 0.014, 0.068), u=12, v=7)            # the toe
    b.ball(1.0, (-0.01, 0, 0.11), tn(m, 0.3, 0.75), sc=(0.17, W / 2 - 0.008, 0.08), u=12, v=7)                  # the vamp
    b.ball(1.0, (x0 + 0.1, 0, 0.125), tn(m, 0.3, 0.75), sc=(0.1, W / 2 - 0.016, 0.095), u=10, v=6)              # the heel
    top = {"sneaker": 0.2, "ankle": 0.3, "boot": 0.42, "rain": 0.5}[kind]
    if kind == "sneaker":
        b.ball(1.0, (x1 - 0.085, 0, 0.085), trim, sc=(0.088, W / 2 - 0.018, 0.056), u=10, v=6)                   # toe cap
        b.ball(1.0, (x0 + 0.1, 0, 0.19), d, sc=(0.09, W / 2 - 0.03, 0.03), u=12, v=6)                             # padded collar
        b.ball(1.0, (0.0, 0, 0.19), l, sc=(0.09, 0.075, 0.024), u=12, v=6, rot=(0, -0.2, 0))                      # tongue
        return
    rs = W / 2 - 0.016; cx = x0 + 0.12
    b.lathe([(rs * 0.96, 0.08), (rs, 0.17), (rs * 0.95, top * 0.68), (rs * 0.98, top - 0.02), (rs * 1.03, top), (rs * 0.86, top + 0.006), (rs * 0.8, top - 0.03), (0, top - 0.03)],
            (cx, 0, 0), mats=[m, m, m, l, l, d, d], seg=18)
    b.ball(1.0, (x0 + 0.06, 0, 0.14), d, sc=(0.05, W / 2 - 0.035, 0.07), u=12, v=7)                               # heel counter

def pair(b, fn, gap=0.17, splay=0.12):
    """Two of something side by side, toes to the front and turned out a little."""
    for sg in (-1, 1):
        sub(b, fn, Matrix.Translation((sg * gap, 0, 0)) @ Matrix.Rotation(-pi / 2 + sg * splay, 4, "Z"))

def seed_packet(b, icon, band_m="green"):
    """A plump paper packet, 0.27 x 0.15 x 0.36 m, standing on its base: a crimped header in the crop's colour and a
    round window with the crop in relief."""
    b.box((0.27, 0.09, 0.3), (0, 0, 0.15), tn("paper", 0.22, None), r=0.04, seg=3)
    teeth = [(-0.135, 0.28), (0.135, 0.28), (0.135, 0.345)] + [(0.135 - 0.027 * i, 0.345 + (0.018 if i % 2 else 0.0)) for i in range(1, 10)] + [(-0.135, 0.345)]
    b.prism(teeth, 0.05, band_m, mtx=XZ(-0.025))
    b.prism(circle(0.108, 24), 0.014, band_m, mtx=XZ(-0.055, 0, 0.165)); b.prism(circle(0.092, 24), 0.014, "cream", mtx=XZ(-0.062, 0, 0.165))
    icon(b, -0.062, 0.165)

def tag(b, at, icon=None, m="paper", s=1.0):
    """A paper tag on a string, hanging to the front right of `at` (where the string is tied). s scales it."""
    x, y, z = at
    b.tube([(x, y, z), (x + 0.07 * s, y - 0.075 * s, z), (x + 0.095 * s, y - 0.11 * s, z - 0.06 * s)], 0.011, "rope", seg=5)
    b.box((0.15 * s, 0.016, 0.18 * s), (x + 0.1 * s, y - 0.12 * s, z - 0.15 * s), m, r=0.006, seg=1, rot=(0.1, 0, -0.15))
    if icon: icon(b, (x + 0.097 * s, y - 0.12 * s - 0.013, z - 0.155 * s))

def rrect(w, h, r, n=5):
    """Outline of a rectangle with round corners, centred on the origin."""
    out = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, pi / 2), (-w / 2 + r, -h / 2 + r, pi), (w / 2 - r, -h / 2 + r, 3 * pi / 2)):
        out += [(cx + r * cos(a0 + pi / 2 * i / n), cy + r * sin(a0 + pi / 2 * i / n)) for i in range(n + 1)]
    return out

def swirl(b, z, R=0.1, m="white"):
    """A swirl of whipped cream sitting at height z. Returns its top."""
    for r, dz, sq in ((R, 0.013, 0.42), (R * 0.74, 0.047, 0.45), (R * 0.46, 0.077, 0.5)):
        b.ball(r, (0, 0, z + dz), tn(m, 0.3, None), sc=(1, 1, sq), u=14, v=7)
    b.lathe([(0.0, 0.0), (R * 0.3, 0.0), (R * 0.18, 0.03), (0.0, 0.05)], (R * 0.06, 0, z + 0.09), m, seg=8, rot=(0, 0.35, 0))
    return z + 0.14

def berry(b, p, r, m, stalk=False):
    b.ball(r, p, tn(m, None, 0.62), u=8, v=6)
    if stalk: leaf(b, (p[0], p[1], p[2] + r * 0.8), r * 1.3, "leaf_light", 0.7 + p[0] * 9, 0.5)
