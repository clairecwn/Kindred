"""Kindred hair + face toolkit. Load with:
    exec(open('/Users/clairewn/Downloads/Kindred/assets_blender/tools/kindred_hair.py').read())
Then call PH['setup']() once per Blender session before building.
"""
import bpy, bmesh, math, os
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

PH = {}
bpy.app.driver_namespace["PH"] = PH

def cl(x, a, b): return a if x < a else (b if x > b else x)
def ss(t):
    t = cl(t, 0.0, 1.0); return t*t*(3-2*t)
PH["cl"] = cl; PH["ss"] = ss

def interp_ctrl(ctrl):
    pts = sorted(ctrl)
    def f(a):
        d = math.degrees(a) % 360.0
        if d > 180: d = 360 - d
        for i in range(len(pts)-1):
            d0, v0 = pts[i]; d1, v1 = pts[i+1]
            if d0 <= d <= d1:
                t = ss((d-d0)/(d1-d0)); return v0*(1-t)+v1*t
        return pts[-1][1] if d > pts[-1][0] else pts[0][1]
    return f
PH["interp_ctrl"] = interp_ctrl

def resample(path, npts):
    seg = [0.0]
    for i in range(1, len(path)):
        seg.append(seg[-1] + math.dist(path[i][:2], path[i-1][:2]))
    total = seg[-1] or 1e-9
    out = []
    for k in range(npts):
        s = total*k/(npts-1); j = 0
        while j < len(seg)-2 and seg[j+1] < s: j += 1
        t = (s-seg[j])/max(1e-9, (seg[j+1]-seg[j]))
        p0, p1 = path[j], path[j+1]
        out.append(tuple(p0[m]+(p1[m]-p0[m])*t for m in range(len(p0))))
    return out
PH["resample"] = resample

def tree_of(name):
    me = bpy.data.objects[name].data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices],
                                [list(p.vertices) for p in me.polygons],
                                all_triangles=False, epsilon=0.0)
PH["tree_of"] = tree_of

def radial_field(body_name, zlo, zhi, ncol=96, nz=170, close=10, ztop_free=None):
    tree = tree_of(body_name)
    zs = [zlo+(zhi-zlo)*i/(nz-1) for i in range(nz)]
    ztop_free = ztop_free if ztop_free is not None else zhi-0.17
    kfree = max(i for i, z in enumerate(zs) if z <= ztop_free)
    raw = []
    for c in range(ncol):
        a = 2*math.pi*c/ncol; d = Vector((math.sin(a), -math.cos(a), 0.0))
        row = []
        for z in zs:
            org = Vector((0, 0, z)); hit = tree.ray_cast(org, d, 3.0)
            row.append((hit[0]-org).length if hit[0] is not None else 0.0)
        raw.append(row)
    dil = lambda r, k: [max(r[max(0, i-k):min(len(r), i+k+1)]) for i in range(len(r))]
    ero = lambda r, k: [min(r[max(0, i-k):min(len(r), i+k+1)]) for i in range(len(r))]
    tab = [ero(dil(r[:kfree+1], close), close) + r[kfree+1:] for r in raw]
    def cdil(t, k):
        n = len(t); return [[max(t[(c+j) % n][i] for j in range(-k, k+1)) for i in range(nz)] for c in range(n)]
    def cero(t, k):
        n = len(t); return [[min(t[(c+j) % n][i] for j in range(-k, k+1)) for i in range(nz)] for c in range(n)]
    tab = cero(cdil(tab, 4), 4)
    for _ in range(4):
        n = len(tab)
        tab = [[(tab[(c-1) % n][i]+tab[(c+1) % n][i]+2*tab[c][i])/4 for i in range(nz)] for c in range(n)]
        tab = [[(r[max(0, i-1)]+2*r[i]+r[min(nz-1, i+1)])/4 for i in range(nz)] for r in tab]
    def F(a, z):
        a = a % (2*math.pi)
        fc = a/(2*math.pi)*ncol; c0 = int(math.floor(fc)) % ncol; c1 = (c0+1) % ncol; tc = fc-math.floor(fc)
        zz = cl(z, zlo, zhi); fz = (zz-zlo)/(zhi-zlo)*(nz-1); i0 = int(math.floor(fz)); i1 = min(nz-1, i0+1); tz = fz-i0
        g = lambda c: tab[c][i0]*(1-tz)+tab[c][i1]*tz
        return g(c0)*(1-tc)+g(c1)*tc
    return F
PH["radial_field"] = radial_field

def outer_envelope(body_name, zlo=0.45, zhi=1.22, ncol=72, nz=48, sm=8):
    """Radius of the OUTERMOST body surface per angle and height, measured from
    the mesh vertices.

    radial_field casts from the central axis and keeps the first hit, so below the
    shoulders it reports the torso and misses the arms entirely - 0.26 where the
    hands actually reach 0.52. That is why long hair hung straight through the
    hands: the floor it was clamped against did not know the arms were there."""
    me = bpy.data.objects[body_name].data
    grid = [[0.0]*ncol for _ in range(nz)]
    for v in me.vertices:
        p = v.co
        if not (zlo <= p.z <= zhi): continue
        r = math.hypot(p.x, p.y)
        j = int(round((p.z-zlo)/(zhi-zlo)*(nz-1)))
        a = math.atan2(p.x, -p.y) % (2*math.pi)
        i = int(round(a/(2*math.pi)*ncol)) % ncol
        for dj in (-1, 0, 1):
            jj = min(nz-1, max(0, j+dj))
            for di in (-1, 0, 1):
                ii = (i+di) % ncol
                if r > grid[jj][ii]: grid[jj][ii] = r
    # running max downward: whatever the arm reaches at the shoulder is carried
    # down past it, so hair that clears the shoulder also clears the elbow and the
    # hand. Without it the envelope dips wherever the arm happens to be thin and
    # the hair dives back inside.
    for j in range(nz-2, -1, -1):
        for i in range(ncol):
            if grid[j+1][i] > grid[j][i]: grid[j][i] = grid[j+1][i]
    for _ in range(sm):
        g2 = [row[:] for row in grid]
        for j in range(nz):
            for i in range(ncol):
                acc = 0.0; n = 0
                for dj in (-1, 0, 1):
                    jj = j+dj
                    if not (0 <= jj < nz): continue
                    for di in (-1, 0, 1):
                        acc += grid[jj][(i+di) % ncol]; n += 1
                g2[j][i] = acc/n
        grid = g2
    def E(a, z):
        if z < zlo or z > zhi: return 0.0
        t = (z-zlo)/(zhi-zlo)*(nz-1)
        j0 = min(nz-1, max(0, int(t))); j1 = min(nz-1, j0+1); fz = t-j0
        u = (a % (2*math.pi))/(2*math.pi)*ncol
        i0 = int(u) % ncol; i1 = (i0+1) % ncol; fa = u-int(u)
        r0 = grid[j0][i0]*(1-fa)+grid[j0][i1]*fa
        r1 = grid[j1][i0]*(1-fa)+grid[j1][i1]*fa
        return r0*(1-fz)+r1*fz
    return E
PH["outer_envelope"] = outer_envelope

def drape_of(F, zlo, zhi, nz=170, ncol=96, window=0.20, sm=60):
    zs = [zlo+(zhi-zlo)*i/(nz-1) for i in range(nz)]
    w = max(1, int(window/((zhi-zlo)/(nz-1))))
    tab = [[F(2*math.pi*c/ncol, z) for z in zs] for c in range(ncol)]
    out = [[max(tab[c][i:min(nz, i+w+1)]) for i in range(nz)] for c in range(ncol)]
    for _ in range(sm):
        out = [[(out[c][max(0, i-1)]+2*out[c][i]+out[c][min(nz-1, i+1)])/4 for i in range(nz)] for c in range(ncol)]
        out = [[(out[(c-1) % ncol][i]+2*out[c][i]+out[(c+1) % ncol][i])/4 for i in range(nz)] for c in range(ncol)]
    def D(a, z):
        a = a % (2*math.pi)
        fc = a/(2*math.pi)*ncol; c0 = int(math.floor(fc)) % ncol; c1 = (c0+1) % ncol; tc = fc-math.floor(fc)
        zz = cl(z, zlo, zhi); fz = (zz-zlo)/(zhi-zlo)*(nz-1); i0 = int(math.floor(fz)); i1 = min(nz-1, i0+1); tz = fz-i0
        g = lambda c: out[c][i0]*(1-tz)+out[c][i1]*tz
        return g(c0)*(1-tc)+g(c1)*tc
    return D
PH["drape_of"] = drape_of

def cap_r(a, A, Bf, Bb, q=2.4):
    s = abs(math.sin(a)); c = math.cos(a)
    B = Bf if c > 0 else Bb
    return ((s/A)**q + (abs(c)/B)**q)**(-1.0/q)
PH["cap_r"] = cap_r

def cap_fit(F, band, q=2.4, margin=1.065, front=1.0, back=1.06, ncol=96, nz=16):
    zs = [band[0]+(band[1]-band[0])*i/(nz-1) for i in range(nz)]
    A0 = max(F(math.pi/2, z) for z in zs)
    Bf0 = max(F(0.0, z) for z in zs)*front
    Bb0 = max(F(math.pi, z) for z in zs)*back
    s = 0.0
    for c in range(ncol):
        a = 2*math.pi*c/ncol
        for z in zs:
            need = F(a, z)/cap_r(a, A0, Bf0, Bb0, q)
            if need > s: s = need
    k = s*margin
    return A0*k, Bf0*k, Bb0*k
PH["cap_fit"] = cap_fit

TAGKEY = {"kai": "", "juno": "Juno_", "sage": "Sage_", "tobi": "Tobi_", "wren": "Wren_"}
PH["TAGKEY"] = TAGKEY

def make_cap(k, zeq=1.42, lift=0.10, p=2.2, q_eq=2.4, q_top=2.0,
             flare=0.030, flare_span=0.30, zbot=0.85, n=200, inflate=1.0):
    A, Bf, Bb = PH["CAP_"+k]
    A *= inflate; Bf *= inflate; Bb *= inflate
    ZT = PH["TOPS"][TAGKEY[k]] + lift
    def cap(a):
        out = [(0.0, ZT+0.004)]
        for i in range(n):
            z = ZT-(ZT-zbot)*i/(n-1)
            if z >= zeq:
                t = cl((z-zeq)/(ZT-zeq), 0.0, 1.0)
                q = q_eq+(q_top-q_eq)*ss(t)
                r = cap_r(a, A, Bf, Bb, q)*max(0.0, (1.0-t**p))**(1.0/p)
            else:
                t = cl((zeq-z)/flare_span, 0.0, 1.0)
                r = cap_r(a, A, Bf, Bb, q_eq)*(1.0+flare*ss(t))
            out.append((r, z))
        return out
    cap.ZT = ZT
    return cap
PH["make_cap"] = make_cap

def smooth_mesh(me, passes=1, factor=0.25, pin_boundary=True):
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bnd = {v.index for v in bm.verts if any(e.is_boundary for e in v.link_edges)} if pin_boundary else set()
    for _ in range(passes):
        new = {}
        for v in bm.verts:
            if v.index in bnd: continue
            nb = [e.other_vert(v).co for e in v.link_edges]
            if not nb: continue
            new[v.index] = v.co.lerp(sum(nb, Vector())/len(nb), factor)
        for i, co in new.items(): bm.verts[i].co = co
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["smooth_mesh"] = smooth_mesh

def relax_hem(me, passes=3, k=0.30):
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    for _ in range(passes):
        new = {}
        for v in bm.verts:
            be = [e for e in v.link_edges if e.is_boundary]
            if len(be) != 2: continue
            new[v.index] = v.co.lerp((be[0].other_vert(v).co+be[1].other_vert(v).co)/2.0, k)
        for i, co in new.items(): bm.verts[i].co = co
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["relax_hem"] = relax_hem

def push_out_smooth(me, tree, gap=0.014, zlo=1.10, diffuse=8, k=0.5):
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.normal_update()
    need = [0.0]*len(bm.verts); nrm = [v.normal.copy() for v in bm.verts]
    for v in bm.verts:
        if v.co.z < zlo: continue
        loc, nor, idx, d = tree.find_nearest(v.co, 1.0)
        if loc is None: continue
        sd = (v.co-loc).dot(nor)
        if sd < gap: need[v.index] = gap-sd; nrm[v.index] = nor.copy()
    if any(need):
        for _ in range(diffuse):
            new = list(need)
            for v in bm.verts:
                nb = [need[e.other_vert(v).index] for e in v.link_edges]
                if nb: new[v.index] = max(need[v.index], (1-k)*need[v.index]+k*(sum(nb)/len(nb)))
            need = new
        for v in bm.verts:
            if need[v.index] > 1e-6: v.co = v.co+nrm[v.index]*need[v.index]
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["push_out_smooth"] = push_out_smooth

def face_clear(me, tree, zlo=1.10):
    bm = bmesh.new(); bm.from_mesh(me); vals = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.z < zlo: continue
        l, n, i, d = tree.find_nearest(c, 1.0)
        if l: vals.append((c-l).dot(n))
    bm.free(); return round(min(vals), 4) if vals else None
PH["face_clear"] = face_clear

def feather_solidify(me, thick_max=0.026, thick_edge=0.0035, ramp=5):
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); bm.normal_update()
    INF = 10**6; dist = {v.index: INF for v in bm.verts}
    cur = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    for v in cur: dist[v.index] = 0
    d = 0
    while cur and d < ramp:
        d += 1; nxt = []
        for v in cur:
            for e in v.link_edges:
                w = e.other_vert(v)
                if dist[w.index] > d: dist[w.index] = d; nxt.append(w)
        cur = nxt
    def th(v):
        k = min(dist[v.index], ramp)/float(ramp); k = k*k*(3-2*k)
        return thick_edge+(thick_max-thick_edge)*k
    outer = list(bm.verts)
    inner = {v.index: bm.verts.new(v.co - v.normal*th(v)) for v in outer}
    bm.verts.ensure_lookup_table()
    for f in list(bm.faces):
        nf = bm.faces.new(tuple(reversed([inner[v.index] for v in f.verts]))); nf.smooth = True
    for e in list(bm.edges):
        if e.is_boundary and all(x.index in inner for x in e.verts):
            a, b = e.verts
            try:
                nf = bm.faces.new((a, b, inner[b.index], inner[a.index])); nf.smooth = True
            except ValueError: pass
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["feather_solidify"] = feather_solidify

def pin_apex(me):
    if "apex" not in me.keys(): return
    ax, ay, az = me["apex"]; best = None
    for v in me.vertices:
        d = (v.co.x-ax)**2+(v.co.y-ay)**2
        if best is None or d < best[0]: best = (d, v.index)
    me.vertices[best[1]].co = Vector((ax, ay, az)); me.update()
PH["pin_apex"] = pin_apex

def bump_above(me, amp, freq, seed, zlo=1.34, fade=0.12):
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    for v in bm.verts:
        p = v.co; k = cl((p.z-zlo)/fade, 0.0, 1.0)
        if k <= 0: continue
        n = noise.noise(Vector((p.x*freq+seed, p.y*freq+seed*1.7, p.z*freq+seed*2.3)))
        v.co = p+v.normal*(amp*n*k)
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["bump_above"] = bump_above

def front_window(a, lo=0.0, hi=70.0, feather=30.0):
    d = abs(((math.degrees(a)+180) % 360)-180)
    if d <= hi-feather: return 1.0
    if d >= hi: return 0.0
    return ss((hi-d)/feather)
PH["front_window"] = front_window

def bangs(base_ctrl, n=3, amp=0.075, span=(6.0, 64.0), phase=0.0, asym=0.0,
          sweep=0.0, skew=0.55, lift=0.0):
    """Rounded locks rather than a saw edge.

    The old profile was abs(sin(pi*n*u))**0.78. abs(sin) has a corner wherever it
    touches zero, so every lock met its neighbour at a hard V and the hairline
    rendered as a row of triangles. A raised cosine has zero slope at both the
    top and the bottom of each lock, and phase-skewing it inside the cosine
    sweeps each lock to one side so they read as hair falling across the brow
    instead of a zigzag."""
    fe = interp_ctrl(base_ctrl)
    lo, hi = span
    def f(a):
        z = fe(a)+asym*math.sin(a)
        d = ((math.degrees(a)+180) % 360)-180
        s = 1.0 if d >= 0 else -1.0
        ad = abs(d)
        if ad > hi: return z
        u = cl((ad-lo)/(hi-lo), 0.0, 1.0) if hi > lo else 0.0
        w = ss((1.0-u)/0.18)
        th = 2*math.pi*n*u+phase
        g = 0.5*(1.0-math.cos(th-skew*math.sin(th)))
        return z-amp*(1.0+sweep*s)*w*g+lift*w
    return f
PH["bangs"] = bangs

def _pol(r, ang, z, dy=0.0):
    return Vector((r*math.sin(ang), -r*math.cos(ang)+dy, z))
PH["_pol"] = _pol

def _res3(path, npts):
    """Arc-length resample a 3D polyline. The stock resample() measures only the
    first two components, which is wrong for a near-vertical hair column."""
    seg = [0.0]
    for i in range(1, len(path)):
        seg.append(seg[-1]+(path[i]-path[i-1]).length)
    total = seg[-1] or 1e-9
    out = []
    for k in range(npts):
        s = total*k/(npts-1); j = 0
        while j < len(seg)-2 and seg[j+1] < s: j += 1
        t = (s-seg[j])/max(1e-9, (seg[j+1]-seg[j]))
        out.append(path[j].lerp(path[j+1], t))
    return out
PH["res3"] = _res3

def taubin(me, passes=6, lam=0.52, mu=-0.54, pin_boundary=False, pin=None):
    """Volume-preserving smoothing. A plain Laplacian pass shrinks the mesh, which
    is why repeated smoothing used to flatten the crown and then need pushing back
    out, and the push-back is what printed lumps. lam/mu alternation removes the
    high-frequency ripple without moving the low-frequency shape."""
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    skip = set()
    if pin_boundary:
        skip = {v.index for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
    if pin: skip |= set(pin)
    nbrs = {v.index: [e.other_vert(v).index for e in v.link_edges] for v in bm.verts}
    co = {v.index: v.co.copy() for v in bm.verts}
    for p in range(passes*2):
        f = lam if p % 2 == 0 else mu
        new = {}
        for i, nb in nbrs.items():
            if i in skip or not nb: continue
            c = Vector((0, 0, 0))
            for j in nb: c += co[j]
            new[i] = co[i]+(c/len(nb)-co[i])*f
        co.update(new)
    for v in bm.verts: v.co = co[v.index]
    bm.normal_update(); bm.to_mesh(me); bm.free()
PH["taubin"] = taubin

def build_hair(name, cap, Rc, Z_END, ZT, zeq, z_sep=1.360,
               NCOL=104, NROW=56, DREF=0.80, swell=0.12, taper=0.58,
               drift=0.10, tip_taper=0.60, tip_span=0.10, flick=0.0, flick_above=1.45,
               nape=0.10, nape_at=0.09, nape_w=0.11,
               locks=7, lock_amp=0.060, lock_z=0.070, scalp_rip=0.016,
               curl_amp=0.080, curl_len=0.55, twist=0.060, curl_on=0.12,
               skin_gap=0.006, soft=0.022, zfloor_max=None, volume=0.0, fdrift=0.0, flow=0.0, flow_span=0.55, wave_at=0.14, wave_phase=1.6, sdrift=0.0, sdrift_at=1.16,
               NSCALP=None, NFALL=None, rowpow=None):
    """Each column is one continuous curve from the crown to its own hem, sampled
    densely and then resampled by ARC LENGTH to a fixed row count.

    The previous version laid rows on a single z-schedule shared by every column
    and clamped each row up to that column's hem. On the forehead, where the hem
    sits high, that piled a dozen stations onto one point: remove_doubles welded
    them and left slivers and folded faces along the hairline, which is what read
    as random lines in the fringe. It also stepped the radius at z_sep, because
    the scalp carried a (1+scalp_rip) factor that the fall did not, and that step
    is the ring around the back of the head.

    Arc-length columns fix both: no station is ever clamped, row spacing is even
    along the whole length, and the fall starts from exactly the radius the scalp
    ended at, slope included.
    """
    if zfloor_max is not None:
        base = Rc; Rc = lambda a, z, _b=base, _zm=zfloor_max: (_b(a, z) if z <= _zm else 0.0)
    fe = Z_END if callable(Z_END) else interp_ctrl(Z_END)

    def ripple(a):
        """Three harmonics instead of one. A single cosine gives a regular
        corrugation that reads as a pattern, not as hair; overlapping clumps of
        different widths read as hair. The old version multiplied by sin(a)**2 to
        keep a crest off the symmetry plane, but that also forced the relief to
        ZERO straight down the centre of the back, which is part of why the back
        of a long style looked like a smooth cap sitting on a textured curtain.
        With integer harmonics the function is periodic and smooth everywhere, so
        no window is needed."""
        # harmonics have to stay well inside what NCOL can resolve. The old third
        # harmonic ran at 3*locks+2 = 23 cycles round the head against 76 columns,
        # about 3 samples per cycle, so it aliased into faceted wrinkles instead
        # of reading as clumps. 7/10/12 against 104 columns is 8+ samples each.
        # phase offsets must be 0 or pi, or the function stops being even in a and
        # the two sides of the head get different relief - one side waves while
        # the other flattens. cos(k*a + 1.10) at a = +90 and a = -90 are not the
        # same number; cos(k*a + pi) at those angles are.
        return (0.58*math.cos(locks*a+math.pi)
                + 0.27*math.cos((locks+3)*a+math.pi)
                + 0.15*math.cos((locks+5)*a))

    ends = []
    for c in range(NCOL):
        a = 2*math.pi*c/NCOL
        z0 = fe(a); lf = ss((z_sep-z0)/DREF)
        # only the base harmonic shapes the HEM. The higher harmonics belong on
        # the surface, where they read as overlapping clumps; on the hairline they
        # are one notch every fifteen degrees, which is the fine zigzag across the
        # fringe.
        ends.append(z0-lock_z*math.cos(locks*a+math.pi)*lf)
    # two light passes on the hem itself: enough to round the corner where one
    # lock meets the next, not enough to wash the fringe out
    for _ in range(3):
        ends = [(ends[(i-1) % NCOL]+2*ends[i]+ends[(i+1) % NCOL])/4.0 for i in range(NCOL)]
    ends_s = list(ends)
    for _ in range(6):
        ends_s = [(ends_s[(i-1) % NCOL]+2*ends_s[i]+ends_s[(i+1) % NCOL])/4.0 for i in range(NCOL)]

    cols = []
    for c in range(NCOL):
        a = 2*math.pi*c/NCOL
        z_end = ends[c]; z_tap = ends_s[c]; rip = ripple(a)
        z0 = fe(a); lf = ss((z_sep-z0)/DREF)
        fw = front_window(a, hi=66.0)*ss((z_tap-flick_above)/0.10)
        tta = tip_taper*(1.0-fw)+flick*fw
        prof = cap(a); pz = [p[1] for p in prof]; pr = [p[0] for p in prof]

        def prof_at(z):
            if z >= pz[0]: return pr[0]
            if z <= pz[-1]: return pr[-1]
            lo = 0; hi = len(pz)-1
            while hi-lo > 1:
                mid = (lo+hi)//2
                if pz[mid] >= z: lo = mid
                else: hi = mid
            t = (pz[lo]-z)/max(1e-9, (pz[lo]-pz[hi]))
            return pr[lo]+(pr[hi]-pr[lo])*t

        ztop = pz[0]
        def fl(z, _t=None):
            return 1.0+flow*ss((ztop-z)/max(1e-6, flow_span))
        # every column waves on its own phase and its own amplitude. With one
        # shared phase the crests line up all the way round and the hair shows
        # concentric horizontal rings, which is the banding that kept reading as
        # a seam. Staggering them turns the rings into locks that run past each
        # other, the way hair actually falls.
        # the stagger must be LOW frequency round the head - two cycles, not one
        # per lock. At the lock frequency the wave crests and the lock crests
        # interfere and print a regular diamond lattice, which looks like quilting
        # rather than hair. Two slow cycles just let the waves drift up and down
        # as they travel round.
        ph0 = wave_phase*(math.cos(2.0*a)+0.45*math.cos(3.0*a+math.pi))
        wamp = 1.0+0.16*rip
        def wavez(z):
            """The wave as a function of HEIGHT, running from high on the head
            all the way to the tips. It used to be a function of distance below
            the scalp/fall junction and switched on three centimetres under it,
            so the hair was glassy smooth above that height and rippled below it:
            the eye reads the height where the ripple starts as a line round the
            head, which is the line that kept coming back after the geometry
            itself was already continuous there."""
            u = ztop-z-wave_at
            if u <= 0.0: return 0.0
            return wamp*ss(u/max(1e-6, curl_on))*math.sin(2*math.pi*u/curl_len+ph0)
        r_sep = prof_at(z_sep)*fl(z_sep)
        # the ripple has to reach full strength by z_sep and hold, or the fall
        # starts at a different radius than the scalp ended at
        rip_s = 1.0+scalp_rip*rip
        raw = []
        zstop = max(z_sep, z_end)
        NS = 110
        for i in range(NS+1):
            z = ztop-(ztop-zstop)*(i/float(NS))
            g = cl((ztop-z)/max(1e-6, (ztop-z_sep)), 0.0, 1.0)
            gg = g*g*(3-2*g)
            vol = 1.0+volume*math.sin(math.pi*gg)
            # hair standing progressively away from the skull as it goes down,
            # applied to the scalp AND the fall from the same function of z. Without
            # it the hair is shrink-wrapped to the head until the jaw and then
            # suddenly free, and that step is what makes a long style look like a
            # cap sitting on a separate curtain.
            wv = wavez(z)
            raw.append((prof_at(z)*(1.0+scalp_rip*rip*gg)*vol*fl(z)*(1.0+curl_amp*wv),
                        a+twist*wv, z, 0.0))
        if z_end < z_sep-1e-9:
            span = z_sep-z_end
            NF = 150
            for i in range(1, NF+1):
                d = span*(i/float(NF)); z = z_sep-d
                w = min(1.0, d/DREF)
                ramp = ss(d/0.06)
                # w**0.65 has an INFINITE slope at w=0, so the fall used to
                # leave the scalp with an infinite radial gradient: the radius
                # matched at z_sep but the surface kinked there, and that kink is
                # the horizontal line around the back of the head. A smoothstep
                # bump peaks in the same place with zero slope at the junction.
                sw = ss(w/0.22)*(1.0-ss((w-0.22)/0.78))
                m = 1.0+swell*sw-taper*(w**2.4)
                m *= 1.0-nape*ramp*math.exp(-((d-nape_at)/nape_w)**2)
                # ONE lock amplitude for the whole head, ramping from the value
                # the scalp ends with to the value the length wants. The scalp
                # used to carry scalp_rip and the fall lock_amp, five times
                # larger, so the crown and the length looked like two different
                # materials joined at a line. This is continuous in value and in
                # slope at d=0.
                A = scalp_rip+(lock_amp-scalp_rip)*ss(d/0.30)
                m *= 1.0+A*rip
                wv = wavez(z)
                m *= 1.0+curl_amp*wv
                ae = a+twist*wv
                # Long hair belongs BEHIND the shoulders, not draped over them.
                # Below shoulder height the side locks drift back so the arm's own
                # path is clear - which is how this is solved on a real character.
                # The alternative, bending the arm out of the hair's way, detaches
                # it from the shoulder and reads as a broken joint.
                dy = drift*max(0.0, -math.cos(a))*(w**1.5)+fdrift*max(0.0, math.cos(a))*(w**1.5)
                dy += sdrift*(math.sin(a)**2)*ss((sdrift_at-z)/0.20)
                raw.append((r_sep*m*(fl(z)/fl(z_sep)), ae, z, dy))

        # arc length, then the tip taper measured BACK FROM THE TIP along the
        # curve rather than against an absolute z, so a short column and a long
        # one taper over the same physical distance
        P = [_pol(*q) for q in raw]
        L = [0.0]
        for i in range(1, len(P)): L.append(L[-1]+(P[i]-P[i-1]).length)
        total = L[-1] or 1e-9
        fin = []
        for i, (rr, ae, z, dy) in enumerate(raw):
            # taper over a fixed distance OR a fixed share of the column,
            # whichever is shorter. A short fringe column is not much longer than
            # tip_span, so a fixed distance started the taper near its root and
            # left a ledge running across the fringe.
            tsp = min(tip_span, 0.34*total)
            k = 1.0-ss((total-L[i])/max(1e-6, tsp))
            r = rr*(1.0-tta*k*k)
            b = Rc(ae, z)+skin_gap
            t = (r-b)/soft
            if t < -30: r = b
            elif t <= 30: r = b+soft*math.log1p(math.exp(t))
            fin.append(_pol(r, ae, z, dy))
        cols.append(_res3(fin, NROW))

    me = bpy.data.meshes.new(name); bm = bmesh.new()
    apex = Vector((0, 0, ZT+0.004)); va = bm.verts.new(apex); grid = []
    for pts in cols:
        grid.append([bm.verts.new(p.copy()) for p in pts[1:]])
    for c in range(NCOL):
        c2 = (c+1) % NCOL
        try: bm.faces.new((va, grid[c2][0], grid[c][0]))
        except ValueError: pass
        for i in range(NROW-2):
            try: bm.faces.new((grid[c][i], grid[c2][i], grid[c2][i+1], grid[c][i+1]))
            except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=list(bm.edges))
    for f in bm.faces: f.smooth = True
    bm.normal_update(); bm.to_mesh(me); bm.free()
    me["apex"] = list(apex)
    return me
PH["build_hair"] = build_hair

def _inside(tree, p, d=Vector((0.317, 0.642, 0.698)).normalized()):
    """Ray-parity test. The signed distance from BVHTree.find_nearest uses the
    nearest FACE normal, and near a thin limb or a crease that normal can read
    negative for a point that is actually outside - which is why pushing on that
    signal made hair tips near the hands worse instead of better."""
    o = p.copy(); n = 0
    for _ in range(12):
        h = tree.ray_cast(o, d, 6.0)
        if h[0] is None: break
        n += 1; o = h[0]+d*1e-4
    return n % 2 == 1

def declip(me, tree, zmax=1.15, gap=0.012, diffuse=8, k=0.5):
    """Lift any hair that is genuinely inside the body back out, below the head.

    Only below zmax: a strand root buried in the skull is how the hair is
    attached and must stay, but a lock passing through a hand or a forearm is a
    hole in the character. Displacement is diffused onto the neighbours so a
    lifted vertex does not leave a spike behind."""
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    move = {}
    for v in bm.verts:
        if v.co.z > zmax: continue
        loc, nor, idx, d = tree.find_nearest(v.co, 0.25)
        if loc is None: continue
        if not _inside(tree, v.co): continue
        out = (loc-v.co)
        if out.length < 1e-6: out = nor.copy()
        move[v.index] = out.normalized()*(out.length+gap)
    if not move:
        bm.free(); return 0
    nmoved = len(move)
    full = {v.index: move.get(v.index, Vector((0, 0, 0))) for v in bm.verts}
    for _ in range(diffuse):
        new = dict(full)
        for v in bm.verts:
            nb = [full[e.other_vert(v).index] for e in v.link_edges]
            if not nb: continue
            avg = sum(nb, Vector())/len(nb)
            cur = full[v.index]
            cand = cur*(1-k)+avg*k
            new[v.index] = cand if cand.length > cur.length else cur
        full = new
    for v in bm.verts:
        if full[v.index].length > 1e-6: v.co = v.co+full[v.index]
    bm.normal_update(); bm.to_mesh(me); bm.free()
    return nmoved
PH["declip"] = declip
PH["inside"] = _inside

def install(objname, me, meshname):
    ob = bpy.data.objects[objname]
    mat = ob.data.materials[0] if ob.data.materials else None
    ob.data = me; me.name = meshname
    for p in me.polygons: p.use_smooth = True
    me.materials.clear()
    if mat: me.materials.append(mat)
    ob.vertex_groups.clear()
    # Long hair weighted ENTIRELY to the head is why it passed through the arms
    # and the lap when posed: the body bends and the hair does not follow it. Hair
    # resting on the back belongs to the back. Grade the weights down the chain -
    # head, neck, chest, spine - so the length travels with the torso while the
    # crown still turns with the head.
    gs = {n: ob.vertex_groups.new(name=n) for n in ("head", "neck", "chest", "spine")}
    bands = [(1.30, 1.45, "head", "head"), (1.15, 1.30, "neck", "head"),
             (0.98, 1.15, "chest", "neck"), (0.80, 0.98, "spine", "chest")]
    buckets = {}
    for v in me.vertices:
        z = v.co.z
        if z >= 1.30: pairs = (("head", 1.0),)
        elif z < 0.80: pairs = (("spine", 1.0),)
        else:
            for lo, hi, a, b in bands:
                if lo <= z < hi:
                    t = ss((z-lo)/(hi-lo))
                    pairs = ((b, t), (a, 1.0-t)); break
            else: pairs = (("head", 1.0),)
        for g, wv in pairs:
            if wv <= 1e-3: continue
            buckets.setdefault((g, round(wv, 2)), []).append(v.index)
    for (g, wv), idx in buckets.items():
        gs[g].add(idx, wv, 'REPLACE')
    return ob
PH["install"] = install

def tube(stations, segs=16, bulge=None):
    pts = [Vector(p) for p, _ in stations]; rad = [r for _, r in stations]; n = len(pts)
    tang = []
    for i in range(n):
        t = (pts[1]-pts[0]) if i == 0 else ((pts[-1]-pts[-2]) if i == n-1 else (pts[i+1]-pts[i-1]))
        tang.append(t.normalized())
    up = Vector((0, 0, 1)); ref = tang[0].cross(up)
    if ref.length < 1e-4: ref = tang[0].cross(Vector((0, 1, 0)))
    ref.normalize(); frames = []
    for i in range(n):
        if i > 0:
            ref = ref-tang[i]*ref.dot(tang[i])
            if ref.length < 1e-6: ref = tang[i].cross(up)
            ref.normalize()
        frames.append((ref.copy(), tang[i].cross(ref).normalized()))
    bm = bmesh.new(); rings = []
    for i in range(n):
        u, v = frames[i]; ring = []
        for s in range(segs):
            th = 2*math.pi*s/segs
            rr = rad[i]*(1.0+(bulge(i/(n-1.0), th) if bulge else 0.0))
            ring.append(bm.verts.new(pts[i]+u*(math.cos(th)*rr)+v*(math.sin(th)*rr)))
        rings.append(ring)
    for i in range(n-1):
        for s in range(segs):
            s2 = (s+1) % segs
            bm.faces.new((rings[i][s], rings[i][s2], rings[i+1][s2], rings[i+1][s]))
    bm.faces.new(tuple(reversed(rings[0]))); bm.faces.new(tuple(rings[-1]))
    for f in bm.faces: f.smooth = True
    bm.normal_update(); me = bpy.data.meshes.new("tube"); bm.to_mesh(me); bm.free(); return me
PH["tube"] = tube

def dense_path(st, n=44, smooth=46):
    """Resample a station list, then SMOOTH it into an actual curve.

    Linear interpolation leaves a corner at every original station. A swept tube
    following a polyline pinches at each of those corners, because the frame turns
    the whole way in one segment and the rings on the inside of the turn cross
    each other. That is what the creases on the ponytail are, and no amount of
    smoothing the finished mesh removes them, because the surface there is folded
    through itself rather than merely rough. Taubin on the path spreads each turn
    over many segments without shortening the curve.
    """
    P = [Vector(p) for p, _ in st]; Rr = [r for _, r in st]
    seg = [0.0]
    for i in range(1, len(P)): seg.append(seg[-1]+(P[i]-P[i-1]).length)
    tot = seg[-1] or 1e-9
    pts = []; rad = []
    for k in range(n):
        s = tot*k/(n-1); j = 0
        while j < len(seg)-2 and seg[j+1] < s: j += 1
        t = (s-seg[j])/max(1e-9, seg[j+1]-seg[j])
        pts.append(P[j]+(P[j+1]-P[j])*t)
        rad.append(Rr[j]+(Rr[j+1]-Rr[j])*t)
    for p in range(smooth*2):
        fac = 0.62 if p % 2 == 0 else -0.64
        np_ = list(pts); nr = list(rad)
        for i in range(1, len(pts)-1):
            np_[i] = pts[i]+((pts[i-1]+pts[i+1])*0.5-pts[i])*fac
            nr[i] = rad[i]+((rad[i-1]+rad[i+1])*0.5-rad[i])*fac
        pts, rad = np_, nr
    return list(zip(pts, rad))
PH["dense_path"] = dense_path

def flyaway(pts_r, segs=10):
    return tube(dense_path(pts_r, 26), segs=segs)
PH["flyaway"] = flyaway

def scale_mesh(me, sx=1.0, sy=1.0, sz=1.0):
    for v in me.vertices: v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    me.update(); return me
PH["scale_mesh"] = scale_mesh

def join_meshes(target, others):
    bm = bmesh.new(); bm.from_mesh(target)
    for o in others: bm.from_mesh(o)
    for f in bm.faces: f.smooth = True
    bm.normal_update(); bm.to_mesh(target); bm.free()
    for o in others:
        try: bpy.data.meshes.remove(o)
        except Exception: pass
    return target
PH["join_meshes"] = join_meshes

LAYOUT = {"KindredRig": 0.0, "Juno_KindredRig": 1.7, "Wren_KindredRig": 3.4,
          "Sage_KindredRig": 5.1, "Tobi_KindredRig": 6.8}
TAGS = {"": "KindredRig", "Wren_": "Wren_KindredRig", "Juno_": "Juno_KindredRig",
        "Sage_": "Sage_KindredRig", "Tobi_": "Tobi_KindredRig"}
PARTS = ["Kindred_Body", "FaceInk", "FaceBlush", "FaceWhite", "Tongue", "Hair_Full", "Hair_Hat", "KindredRig"]
LIGHT0 = {"Key": (2.6, -3.2, 3.4), "Fill": (-3.4, -2.2, 1.6), "Rim": (-1.2, 3.4, 2.8)}
PH["LAYOUT"] = LAYOUT; PH["TAGS"] = TAGS; PH["PARTS"] = PARTS; PH["LIGHT0"] = LIGHT0

def solo(tag, hair="Hair_Full"):
    for t in TAGS:
        for p in PARTS:
            n = (t+p) if t else p
            o = bpy.data.objects.get(n)
            if not o: continue
            on = (t == tag)
            if p == "Hair_Full": on = on and hair == "Hair_Full"
            if p == "Hair_Hat": on = on and hair == "Hair_Hat"
            o.hide_render = not on
    for o in bpy.data.objects:
        if o.name.startswith(("Top_", "Bottom_", "Acc_")) or o.name in ("Dress", "Hair", "TmpGround"):
            o.hide_render = True
PH["solo"] = solo

def cam2(target, dist, az, el, lens=70, res=700, xoff=0.0):
    c = bpy.data.objects["Cam"]; t = Vector(target)
    bpy.data.objects["CamTarget"].location = t
    a = math.radians(az); e = math.radians(-el)
    d = Vector((math.sin(a)*math.cos(e), -math.cos(a)*math.cos(e), math.sin(e)))
    c.location = t-d*dist; c.data.lens = lens
    for n, (lx, ly, lz) in LIGHT0.items(): bpy.data.objects[n].location = (lx+xoff, ly, lz)
    s = bpy.context.scene; s.render.resolution_x = res; s.render.resolution_y = res; s.render.resolution_percentage = 100
PH["cam2"] = cam2

CHK = "/Users/clairewn/Downloads/Kindred/assets_blender/_chk/"
def raw_shot(name, tag, z, dist, az, el, lens=70, res=700):
    x = LAYOUT[TAGS[tag]]
    cam2((x, 0, z), dist, az, el, lens, res, xoff=x)
    os.makedirs(CHK, exist_ok=True)
    bpy.context.scene.render.filepath = CHK+name+".png"
    bpy.ops.render.render(write_still=True)
    return CHK+name+".png"
def shot(name, tag, z, dist, az, el, lens=70, res=700, hair="Hair_Full"):
    solo(tag, hair); return raw_shot(name, tag, z, dist, az, el, lens, res)
PH["raw_shot"] = raw_shot; PH["shot"] = shot

def mouth_box(tag):
    o = bpy.data.objects[(tag+"FaceInk") if tag else "FaceInk"]
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen = set(); best = None
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; comp = []; seen.add(v.index)
        while st:
            c = st.pop(); comp.append(c.co.copy())
            for e in c.link_edges:
                w = e.other_vert(c)
                if w.index not in seen: seen.add(w.index); st.append(w)
        zc = sum(p.z for p in comp)/len(comp)
        if best is None or zc < best[0]: best = (zc, comp)
    bm.free(); pts = best[1]
    return {"x": [min(p.x for p in pts), max(p.x for p in pts)],
            "y": [min(p.y for p in pts), max(p.y for p in pts)],
            "z": [min(p.z for p in pts), max(p.z for p in pts)]}
PH["mouth_box"] = mouth_box

def ink_depth_at_mouth(tag):
    mb = mouth_box(tag)
    T = tree_of((tag+"Kindred_Body") if tag else "Kindred_Body")
    me = bpy.data.objects[(tag+"FaceInk") if tag else "FaceInk"].data
    ds = []
    for v in me.vertices:
        if not (mb["z"][0]-0.005 <= v.co.z <= mb["z"][1]+0.005): continue
        loc, nor, idx, d = T.find_nearest(v.co, 1.0)
        if loc: ds.append((v.co-loc).dot(nor))
    return (min(ds), max(ds)) if ds else (0.003, 0.006)
PH["ink_depth_at_mouth"] = ink_depth_at_mouth

def flatten_tongue(tag, over=0.0013):
    lo, hi = ink_depth_at_mouth(tag)
    off = hi+over
    T = tree_of((tag+"Kindred_Body") if tag else "Kindred_Body")
    me = bpy.data.objects[(tag+"Tongue") if tag else "Tongue"].data
    out = []
    for v in me.vertices:
        hit = T.ray_cast(Vector((v.co.x, -1.5, v.co.z)), Vector((0, 1, 0)), 3.0)
        base = hit[0].y if hit[0] is not None else -0.40
        out.append(Vector((v.co.x, base-off, v.co.z)))
    for i, p in enumerate(out): me.vertices[i].co = p
    me.update()
    return round(off, 4)
PH["flatten_tongue"] = flatten_tongue

def setup():
    TOPS = {}
    for tag in ["", "Juno_", "Sage_", "Tobi_", "Wren_"]:
        body = (tag+"Kindred_Body") if tag else "Kindred_Body"
        k = (tag[:-1].lower() if tag else "kai")
        zt = max(v.co.z for v in bpy.data.objects[body].data.vertices)
        TOPS[tag] = zt
        PH["T_"+k] = tree_of(body)
        F = radial_field(body, 0.50, zt)
        PH["F_"+k] = F
        D0 = drape_of(F, 0.50, zt)
        E = outer_envelope(body)
        def D(a, z, _d=D0, _e=E):
            # below the shoulders the floor has to enclose the ARMS, or hair that
            # reaches that far hangs straight through them
            return max(_d(a, z), _e(a, z)*1.035)
        PH["D_"+k] = D
        PH["CAP_"+k] = cap_fit(F, (1.28, 1.62))
    PH["TOPS"] = TOPS
    return {k: [round(x, 3) for x in PH["CAP_"+k]] for k in ["kai", "juno", "sage", "tobi", "wren"]}
PH["setup"] = setup

def build_char(tag, k, ctrl, kw, extras=None, bump_kw=None, hat_squash=None,
               gap=0.012, tmax=0.026, tedge=0.0035, zeq=1.42, lift=0.10, p=2.2,
               bang=None, flick=0.0, flick_above=1.45):
    tree = PH["T_"+k]; D = PH["D_"+k]; ht = PH["TOPS"][tag]
    ze = bangs(ctrl, **bang) if bang else ctrl
    kw2 = dict(kw); kw2.update(flick=flick, flick_above=flick_above, zfloor_max=ht-0.06)
    out = {}
    for which, infl, g, tm, te in (("full", 1.035, gap, tmax, tedge),
                                   ("hat", 0.955, gap*0.75, tmax*0.7, tedge*0.85)):
        cap = make_cap(k, zeq=zeq, lift=lift, p=p, inflate=infl)
        m = build_hair("H_"+tag+which, cap, D, ze, cap.ZT, zeq, skin_gap=g, **kw2)
        # no noise displacement: it was the source of the lumps. Texture now comes
        # from the lock ripple and curl, which are smooth functions of angle and
        # arc length, so they read as strands rather than as blisters.
        pin_apex(m)
        push_out_smooth(m, tree, gap=g, diffuse=14, k=0.5)
        taubin(m, passes=4, pin_boundary=True)
        relax_hem(m, 3, 0.30); pin_apex(m)
        push_out_smooth(m, tree, gap=g, diffuse=14, k=0.5)
        taubin(m, passes=3, pin_boundary=True)
        # the superellipse corners meet the lock ripple at the crown and leave
        # four soft dimples there; polish only above z=1.55 so the strand relief
        # lower down survives
        taubin(m, passes=2, pin_boundary=True,
               pin=[v.index for v in m.vertices if v.co.z < 1.62])
        # one more polish over the skull only. The waves live below this height,
        # so they survive; what goes is the small lumpiness on top of the head,
        # where the superellipse corners meet the lock relief.
        taubin(m, passes=9, pin_boundary=True,
               pin=[v.index for v in m.vertices if v.co.z < 1.48])
        pin_apex(m)
        fc = face_clear(m, tree)
        feather_solidify(m, thick_max=tm, thick_edge=te)
        if which == "hat" and hat_squash:
            ZC, TOP = hat_squash
            zt = max(v.co.z for v in m.vertices); kk = (TOP-ZC)/max(1e-6, (zt-ZC))
            for v in m.vertices:
                if v.co.z > ZC: v.co.z = ZC+(v.co.z-ZC)*kk
        if extras:
            ex = []
            for e in extras:
                em = e()
                # relax the tubes before joining. A swept tube whose radius is
                # larger than the radius of curvature at a bend has its rings
                # overlap on the inside of the turn, and that is what the creases
                # at the top of the ponytail are.
                taubin(em, passes=6, lam=0.55, mu=-0.56)
                ex.append(em)
            join_meshes(m, ex)
        # one last light relax over everything. Taubin takes out high frequency
        # before low, so fine wrinkles go and the waves stay.
        taubin(m, passes=3, lam=0.50, mu=-0.52)
        # clear the WHOLE assembly, extras included, out of the body. The earlier
        # passes ran before the ponytail and the braid were joined on and only
        # from z=1.10 up, so a tail or a long fall could sit up to 0.106 inside
        # the shoulder. Measured in the rest pose, which is what the sit and idle
        # clips are built from.
        push_out_smooth(m, tree, gap=0.009, zlo=1.02, diffuse=10, k=0.45)
        declip(m, tree, zmax=1.15)
        name = (tag+"Hair_Full") if which == "full" else (tag+"Hair_Hat")
        install(name, m, name+"_mesh")
        out[which] = {"fc": fc, "verts": len(m.vertices)}
    return out
PH["build_char"] = build_char

def export_all():
    def zero():
        for n in LAYOUT: bpy.data.objects[n].location = (0, 0, 0)
        bpy.context.view_layer.update()
    def restore():
        for n, x in LAYOUT.items(): bpy.data.objects[n].location = (x, 0, 0)
        bpy.context.view_layer.update()
    base = "/Users/clairewn/Downloads/Kindred/public/models/"
    out = {}
    for tag, fn in [("Wren_", "kindred_wren.glb"), ("Juno_", "kindred_juno.glb"),
                    ("Sage_", "kindred_sage.glb"), ("Tobi_", "kindred_tobi.glb"),
                    ("", "kindred_char01.glb")]:
        zero()
        objs = [bpy.data.objects[(tag+p) if tag else p] for p in PARTS if ((tag+p) if tag else p) in bpy.data.objects]
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.hide_viewport = False; o.hide_render = False; o.select_set(True)
        bpy.context.view_layer.objects.active = objs[-1]
        bpy.ops.export_scene.gltf(filepath=base+fn, export_format='GLB', use_selection=True,
                                  export_apply=True, export_animations=True, export_skins=True,
                                  export_yup=True, export_morph=False)
        restore(); out[fn] = os.path.getsize(base+fn)
    want = ["Top_Tee", "Top_Hoodie", "Top_Button", "Top_Bomber", "Top_BomberTrim", "Top_Cardigan", "Dress",
            "Bottom_Joggers", "Bottom_Overalls", "Bottom_Cargo", "Bottom_Skirt",
            "Acc_Cap", "Acc_CapTrim", "Acc_Beanie", "Acc_FlowerClip", "Acc_Glasses", "Acc_Scarf", "Acc_Backpack"]
    zero()
    bpy.ops.object.select_all(action='DESELECT')
    objs = [bpy.data.objects[n] for n in want]+[bpy.data.objects["KindredRig"]]
    for o in objs:
        o.hide_viewport = False; o.hide_render = False; o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]
    wp = base+"kindred_wardrobe.glb"
    bpy.ops.export_scene.gltf(filepath=wp, export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=False, export_skins=True,
                              export_yup=True, export_morph=False)
    restore(); out["kindred_wardrobe.glb"] = os.path.getsize(wp)
    for o in bpy.data.objects:
        if o.name.startswith(("Top_", "Bottom_", "Acc_")) or o.name == "Dress":
            o.hide_render = True; o.hide_viewport = True
    bpy.ops.wm.save_mainfile()
    return out
PH["export_all"] = export_all

def relax_head(tag, zlo=1.08, zhi=1.50, passes=10, lam=0.50, mu=-0.52, cap=0.040):
    """The base head carries hard convex spikes at the jaw corners and at the
    widest point of the cheek: the same vertex indices poke out along their own
    normal by 0.015 to 0.062 on every one of the five. Smooth shading turns those
    into the bumps on the cheeks. Taubin-relax the head band so the silhouette is
    kept, fade the effect to zero at the band edges so no new crease appears
    there, and cap the total move so the jaw does not melt."""
    ob = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
    me = ob.data
    nbrs = {}
    for e in me.edges:
        a, b = e.vertices
        nbrs.setdefault(a, []).append(b); nbrs.setdefault(b, []).append(a)
    orig = {v.index: v.co.copy() for v in me.vertices}
    co = {v.index: v.co.copy() for v in me.vertices}
    fade = {}
    for v in me.vertices:
        z = v.co.z
        if z <= zlo or z >= zhi: fade[v.index] = 0.0
        else:
            t = min((z-zlo)/0.10, (zhi-z)/0.10, 1.0)
            fade[v.index] = ss(t)
    for p in range(passes*2):
        f = lam if p % 2 == 0 else mu
        new = {}
        for i, nb in nbrs.items():
            if fade[i] <= 0.0: continue
            c = Vector((0, 0, 0))
            for j in nb: c += co[j]
            new[i] = co[i]+(c/len(nb)-co[i])*(f*fade[i])
        co.update(new)
    moved = 0.0
    for v in me.vertices:
        d = co[v.index]-orig[v.index]
        if d.length > cap: d = d*(cap/d.length)
        v.co = orig[v.index]+d
        moved = max(moved, d.length)
    me.update()
    return round(moved, 4)
PH["relax_head"] = relax_head

# how far each face island floats above the skin. Order matters: the ring must
# sit under the sclera, the sclera under the iris, the iris under the highlight,
# or the eye reads as a solid black disc or loses its pupil.
DECAL_D = {"ring": 0.0040, "brow": 0.0052, "mouth": 0.0052, "sclera": 0.0052,
           "iris": 0.0064, "hi": 0.0076, "blush": 0.0034, "tongue": 0.0072}

def _islands(me):
    import collections
    par = list(range(len(me.vertices)))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b: par[a] = b
    g = collections.defaultdict(list)
    for v in me.vertices: g[find(v.index)].append(v.index)
    return list(g.values())

def reseat(tag, kind, depth):
    """Drop every vertex of a decal straight onto the body surface and lift it by
    a fixed depth along the body normal. Islands keep their own depth so the eye
    layers stay in order. This is what fixes a blush that has sunk inside the
    cheek (Kai's was 11 mm under the skin) and one whose rim lifts off the curve."""
    name = tag+kind
    if name not in bpy.data.objects: return None
    ob = bpy.data.objects[name]
    body = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
    tree = BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices],
                                [list(p.vertices) for p in body.data.polygons])
    me = ob.data; ds = []
    for v in me.vertices:
        loc, nor, idx, d = tree.find_nearest(v.co, 1.0)
        if loc is None: continue
        v.co = loc+nor*depth; ds.append(d)
    me.update()
    return round(max(ds), 4) if ds else None
PH["reseat"] = reseat
PH["islands"] = _islands

def depth_for(objname, me, g):
    """Which layer a face island belongs to, and how far it floats above the skin.
    Classify the eye parts by VERTICAL EXTENT: the ring reaches z=1.525, so a
    zmax test mistakes it for an eyebrow and puts it at the sclera's depth, which
    shreds the white of the eye. Layers are 2 mm apart; 1.2 mm z-fights."""
    xs = [me.vertices[i].co for i in g]
    zsp = max(p.z for p in xs)-min(p.z for p in xs)
    if "FaceInk" in objname:
        if zsp > 0.15: return 0.0034 if zsp > 0.23 else 0.0074   # eye ring / iris
        return 0.0062 if max(p.z for p in xs) < 1.30 else 0.0054  # mouth / brow
    if "FaceWhite" in objname:
        return 0.0054 if len(g) >= 100 else 0.0094               # sclera / highlight
    if "Blush" in objname: return 0.0026                         # under the eye ring
    if "Tongue" in objname: return 0.0082
    return 0.0054
PH["depth_for"] = depth_for

def reseat_all(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Drop every face decal onto the body and lift it along a SMOOTHED normal.
    find_nearest hands back the flat face normal and the head is low poly, so
    that direction jumps from quad to quad; two layers pushed along a jumping
    direction cross each other. Interpolating the body's vertex normals at the
    hit point keeps the layers parallel and in order."""
    for tag in tags:
        body = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"].data
        verts = [v.co.copy() for v in body.vertices]
        vnor = [v.normal.copy() for v in body.vertices]
        polys = [list(p.vertices) for p in body.polygons]
        tree = BVHTree.FromPolygons(verts, polys)
        def smooth_n(loc, pi):
            idx = polys[pi]; w = []; tot = 0.0
            for i in idx:
                k = 1.0/max((loc-verts[i]).length, 1e-4)**2
                w.append(k); tot += k
            n = Vector((0, 0, 0))
            for k, i in zip(w, idx): n += vnor[i]*(k/tot)
            return n.normalized()
        for part in ["FaceInk", "FaceWhite", "FaceBlush", "Tongue"]:
            nm = tag+part
            if nm not in bpy.data.objects: continue
            me = bpy.data.objects[nm].data
            for g in _islands(me):
                d = PH["depth_for"](nm, me, g)
                for i in g:
                    loc, nor, pi, dd = tree.find_nearest(me.vertices[i].co, 1.0)
                    if loc is None: continue
                    me.vertices[i].co = loc+smooth_n(loc, pi)*d
            me.update()
PH["reseat_all"] = reseat_all

def _island_topology(me, g):
    """boundary loop (ordered) and neighbour map, for one island."""
    import collections
    gs = set(g); ec = collections.Counter(); adj = collections.defaultdict(set)
    for p in me.polygons:
        vs = list(p.vertices)
        if not all(v in gs for v in vs): continue
        for i in range(len(vs)):
            a, b = vs[i], vs[(i+1) % len(vs)]
            ec[tuple(sorted((a, b)))] += 1
            adj[a].add(b); adj[b].add(a)
    bnd = collections.defaultdict(set)
    for (a, b), n in ec.items():
        if n == 1: bnd[a].add(b); bnd[b].add(a)
    loop = []
    if bnd:
        start = next(iter(bnd)); cur, prev = start, None
        while True:
            loop.append(cur)
            nxt = [x for x in bnd[cur] if x != prev]
            if not nxt: break
            prev, cur = cur, nxt[0]
            if cur == start: break
    return loop, adj

def regularise_decals(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Take the jitter out of every face decal, in its own tangent plane.

    Seating a decal by nearest-point projection slides vertices sideways wherever
    the head's curvature changes, and the head is low poly so it changes in steps.
    Three rounds of that left the eye outlines lumpy (up to 10% local wobble on
    the ring, 29% on the blush) which is the distortion in the eyes. Smoothing the
    boundary ALONG the loop and the interior inside it, in 2D, removes the wobble
    without turning an oval into a circle: a 1D Taubin pass on a closed loop keeps
    its low-frequency shape and kills the high-frequency noise."""
    for tag in tags:
        for part in ["FaceInk", "FaceWhite", "FaceBlush", "Tongue"]:
            nm = tag+part
            if nm not in bpy.data.objects: continue
            me = bpy.data.objects[nm].data
            for g in _islands(me):
                if len(g) < 12: continue
                loop, adj = _island_topology(me, g)
                P = {i: me.vertices[i].co.copy() for i in g}
                c = sum(P.values(), Vector())/len(P)
                # tangent frame from the island's own best-fit normal
                n = Vector((0, 0, 0))
                ks = list(P)
                for i in range(len(ks)):
                    n += (P[ks[i]]-c).cross(P[ks[(i+1) % len(ks)]]-c)
                if n.length < 1e-9: continue
                n.normalize()
                t1 = (P[ks[0]]-c); t1 = (t1-n*t1.dot(n))
                if t1.length < 1e-9: continue
                t1.normalize(); t2 = n.cross(t1)
                uv = {i: Vector(((P[i]-c).dot(t1), (P[i]-c).dot(t2))) for i in g}
                # 1) closed-loop Taubin on the boundary
                if len(loop) > 6:
                    for p in range(10):
                        f = 0.55 if p % 2 == 0 else -0.57
                        new = {}
                        for k, i in enumerate(loop):
                            a = uv[loop[(k-1) % len(loop)]]; b = uv[loop[(k+1) % len(loop)]]
                            new[i] = uv[i]+((a+b)/2.0-uv[i])*f
                        uv.update(new)
                # 2) interior relaxes inside the fixed boundary
                fixed = set(loop)
                for _ in range(14):
                    new = {}
                    for i in g:
                        if i in fixed or not adj[i]: continue
                        s = Vector((0, 0))
                        for j in adj[i]: s += uv[j]
                        new[i] = uv[i]+(s/len(adj[i])-uv[i])*0.45
                    uv.update(new)
                for i in g:
                    me.vertices[i].co = c+t1*uv[i].x+t2*uv[i].y
            me.update()
PH["regularise_decals"] = regularise_decals

def reseat_radial(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Seat each decal by casting a ray from the head's centre OUT through the
    vertex, instead of snapping it to the nearest surface point. The vertex keeps
    its exact angular position, so the shape of an eye or a blush is untouched;
    only its distance changes. Nearest-point snapping is what warped them."""
    for tag in tags:
        bob = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
        body = bob.data
        hv = [v.co for v in body.vertices if v.co.z > 1.18]
        C = Vector((0.0, 0.0, sum(p.z for p in hv)/len(hv)))
        tree = BVHTree.FromPolygons([v.co.copy() for v in body.vertices],
                                    [list(p.vertices) for p in body.polygons])
        for part in ["FaceInk", "FaceWhite", "FaceBlush", "Tongue"]:
            nm = tag+part
            if nm not in bpy.data.objects: continue
            me = bpy.data.objects[nm].data
            for g in _islands(me):
                d = PH["depth_for"](nm, me, g)
                for i in g:
                    p = me.vertices[i].co
                    dirv = (p-C)
                    if dirv.length < 1e-6: continue
                    dirv.normalize()
                    hit = tree.ray_cast(C+dirv*0.02, dirv, 3.0)
                    if hit[0] is None:
                        loc, nor, pi, dd = tree.find_nearest(p, 1.0)
                        if loc is None: continue
                        me.vertices[i].co = loc+nor*d
                    else:
                        me.vertices[i].co = hit[0]+dirv*d
            me.update()
PH["reseat_radial"] = reseat_radial

def deburr(tag, zlo=1.08, zhi=1.52, rounds=26, thresh=0.006, k=0.55, cap=0.075):
    """Shave the convex spikes out of the head without melting it.

    The base head has vertices that stand proud of their own neighbourhood by up
    to 0.062 along the normal, at the jaw corners and at the widest point of the
    cheek, on all five characters. A plain relax has to move them a long way
    before the spike goes, because the mesh around them is coarse. This instead
    measures the signed excess at each vertex and removes only the part above a
    threshold, spreading a share onto the neighbours so a dent is not left behind.
    Iterating a small correction converges where one big move would deform."""
    import collections
    ob = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
    me = ob.data
    adj = collections.defaultdict(set)
    for e in me.edges:
        a, b = e.vertices; adj[a].add(b); adj[b].add(a)
    orig = {v.index: v.co.copy() for v in me.vertices}
    band = {}
    for v in me.vertices:
        z = v.co.z
        if z <= zlo or z >= zhi: continue
        band[v.index] = ss(min((z-zlo)/0.10, (zhi-z)/0.10, 1.0))
    for _ in range(rounds):
        me.update()
        move = collections.defaultdict(lambda: Vector((0, 0, 0)))
        for i, f in band.items():
            nb = adj[i]
            if len(nb) < 3: continue
            c = Vector((0, 0, 0))
            for j in nb: c += me.vertices[j].co
            c /= len(nb)
            nrm = me.vertices[i].normal
            e = (me.vertices[i].co-c).dot(nrm)
            x = abs(e)-thresh
            if x <= 0: continue
            corr = nrm*(k*f*(x if e > 0 else -x))
            move[i] -= corr
            for j in nb: move[j] += corr*(0.30/len(nb))
        if not move: break
        for i, dv in move.items():
            me.vertices[i].co = me.vertices[i].co+dv
    worst = 0.0
    for v in me.vertices:
        d = (v.co-orig[v.index])
        if d.length > cap:
            v.co = orig[v.index]+d*(cap/d.length); d = v.co-orig[v.index]
        worst = max(worst, d.length)
    me.update()
    return round(worst, 4)
PH["deburr"] = deburr

def reseat_proj(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Seat each decal by casting along the ISLAND'S OWN normal.

    Radial casting from the head centre is well conditioned for the eyes but
    grazes the cheek, so tiny angular differences turned into large distance
    differences and the blush outline got worse each pass. Casting along the
    island's own normal is near perpendicular to the skin under every decal, and
    it preserves each vertex's position in the island's plane exactly, so no
    island changes shape at all - only how far off the skin it floats."""
    for tag in tags:
        body = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"].data
        tree = BVHTree.FromPolygons([v.co.copy() for v in body.vertices],
                                    [list(p.vertices) for p in body.polygons])
        for part in ["FaceInk", "FaceWhite", "FaceBlush", "Tongue"]:
            nm = tag+part
            if nm not in bpy.data.objects: continue
            me = bpy.data.objects[nm].data
            for g in _islands(me):
                P = {i: me.vertices[i].co.copy() for i in g}
                c = sum(P.values(), Vector())/len(P)
                ks = list(P); n = Vector((0, 0, 0))
                for i in range(len(ks)):
                    n += (P[ks[i]]-c).cross(P[ks[(i+1) % len(ks)]]-c)
                if n.length < 1e-9: continue
                n.normalize()
                # point the frame outward, away from the head's axis
                if n.dot(Vector((c.x, c.y, 0.0)) if (c.x or c.y) else Vector((0, -1, 0))) < 0 \
                   and n.dot(Vector((0, -1, 0))) < 0:
                    n = -n
                d = PH["depth_for"](nm, me, g)
                for i in g:
                    o = P[i]+n*0.25
                    hit = tree.ray_cast(o, -n, 0.60)
                    if hit[0] is None:
                        loc, nor, pi, dd = tree.find_nearest(P[i], 1.0)
                        if loc is None: continue
                        me.vertices[i].co = loc+nor*d
                    else:
                        me.vertices[i].co = hit[0]+n*d
                    vnrm[i] = n.copy()
            me.update()
            # Shade every decal with the SKIN's normal, not its own. A conformed
            # disc has its own internal structure - a hub fan meeting a ring of
            # quads - and smooth shading across that junction prints a faint lens
            # inside the mouth that looks like the black and the red coming apart.
            # Borrowing the surface normal makes the decal shade exactly like the
            # face it sits on, so nothing of its construction shows at all.
            try:
                me.normals_split_custom_set_from_vertices(vnrm)
            except Exception:
                pass
PH["reseat_proj"] = reseat_proj

FACE_PARTS = ["FaceInk", "FaceWhite", "FaceBlush", "Tongue"]

def head_metrics(tag):
    me = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"].data
    hv = [v.co for v in me.vertices if v.co.z > 1.18]
    return max(abs(p.x) for p in hv), sum(p.z for p in hv)/len(hv)
PH["head_metrics"] = head_metrics

def template_faces(src="Wren_", tags=("", "Juno_", "Sage_", "Tobi_")):
    """Copy every face decal from one character onto the others, scaled about the
    head centre. All five share the decal topology, so this is exact. It is the
    only reliable way back from accumulated seating drift: Tobi had one eyebrow
    0.05 higher than the other and one eye ring sized so close to its iris that
    the classifier swapped them, which is why that eye rendered as a black disc.
    Scaling about the head centre preserves every angle, so each character keeps
    its own proportions."""
    sW, sZ = head_metrics(src)
    for tag in tags:
        W, Z = head_metrics(tag); s = W/sW
        for part in FACE_PARTS:
            sm = bpy.data.objects[src+part].data
            dm = bpy.data.objects[tag+part].data
            if len(sm.vertices) != len(dm.vertices): continue
            for i, v in enumerate(sm.vertices):
                p = v.co
                dm.vertices[i].co = Vector((p.x*s, p.y*s, Z+(p.z-sZ)*s))
            dm.update()
PH["template_faces"] = template_faces

def face_depths(objname, me):
    """Depth per island, keyed by island index.

    Classifying by absolute size thresholds is what broke Tobi: his eye ring and
    his iris sit close enough in extent that a fixed cut-off put the ring above
    the sclera, and a filled ring over the white is a solid black eye. Decide it
    by comparison instead - of the two large ink islands on one side of the face,
    the bigger is always the ring and the smaller always the iris."""
    isl = _islands(me)
    out = {}
    if "FaceInk" in objname:
        eyes = []
        for k, g in enumerate(isl):
            xs = [me.vertices[i].co for i in g]
            zsp = max(p.z for p in xs)-min(p.z for p in xs)
            if len(g) >= 100 and zsp > 0.12:
                ext = (max(p.x for p in xs)-min(p.x for p in xs))*zsp
                eyes.append((k, sum(p.x for p in xs)/len(xs), ext))
            else:
                zmax = max(p.z for p in xs)
                out[k] = 0.0062 if zmax < 1.30 else 0.0054   # mouth / brow
        for side in (-1, 1):
            grp = sorted([e for e in eyes if (e[1] >= 0) == (side > 0)],
                         key=lambda e: -e[2])
            for rank, e in enumerate(grp):
                out[e[0]] = 0.0034 if rank == 0 else 0.0074
        return isl, out
    for k, g in enumerate(isl):
        if "FaceWhite" in objname: out[k] = 0.0054 if len(g) >= 100 else 0.0094
        elif "Blush" in objname: out[k] = 0.0026
        elif "Tongue" in objname: out[k] = 0.0082
        else: out[k] = 0.0054
    return isl, out
PH["face_depths"] = face_depths

def reseat_faces(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Cast along each island's own normal, oriented by the head centre rather
    than by a sign test that could pick the wrong way round for a decal on the
    side of the face."""
    for tag in tags:
        body = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"].data
        W, Z = head_metrics(tag); C = Vector((0.0, 0.0, Z))
        tree = BVHTree.FromPolygons([v.co.copy() for v in body.vertices],
                                    [list(p.vertices) for p in body.polygons])
        # the mouth outline and the tongue have to be seated on the SAME normal.
        # Seated on their own, the two islands tilt slightly differently against
        # the curve of the chin and the red slides out from behind the black.
        mouth_n = None
        mi = bpy.data.objects[tag+"FaceInk"].data
        for g in _islands(mi):
            xs = [mi.vertices[i].co for i in g]
            if max(p.z for p in xs)-min(p.z for p in xs) > 0.15: continue
            if sum(p.z for p in xs)/len(xs) > 1.30: continue
            c = sum(xs, Vector())/len(xs); n = Vector((0, 0, 0))
            for i in range(len(xs)): n += (xs[i]-c).cross(xs[(i+1) % len(xs)]-c)
            if n.length > 1e-9:
                n.normalize()
                mouth_n = -n if n.dot(Vector((0, -1, 0))) < 0 else n
        for part in FACE_PARTS:
            nm = tag+part
            if nm not in bpy.data.objects: continue
            me = bpy.data.objects[nm].data
            isl, dep = face_depths(nm, me)
            vnrm = [Vector((0.0, 0.0, 1.0))]*len(me.vertices)
            gs_all = [set(g) for g in isl]
            fn = [Vector((0, 0, 0)) for _ in isl]
            for poly in me.polygons:
                for k, gs in enumerate(gs_all):
                    if all(v in gs for v in poly.vertices):
                        fn[k] += poly.normal*poly.area
                        break
            for k, g in enumerate(isl):
                P = {i: me.vertices[i].co.copy() for i in g}
                c = sum(P.values(), Vector())/len(P)
                # area-weighted FACE normals. Summing cross products around the
                # island's vertex list only works if that list is an ordered loop,
                # and after a rebuild it is whatever order the flood fill produced,
                # so the frame came out at a random angle.
                n = fn[k].copy()
                if n.length < 1e-9: continue
                n.normalize()
                if n.dot(c-C) < 0: n = -n
                if "Tongue" in nm and mouth_n is not None: n = mouth_n
                d = dep[k]
                for i in g:
                    hit = tree.ray_cast(P[i]+n*0.30, -n, 0.70)
                    if hit[0] is None:
                        loc, nor, pi, dd = tree.find_nearest(P[i], 1.0)
                        if loc is None: continue
                        me.vertices[i].co = loc+nor*d
                    else:
                        me.vertices[i].co = hit[0]+n*d
                    vnrm[i] = n.copy()
            me.update()
            # Shade every decal with the SKIN's normal, not its own. A conformed
            # disc has its own internal structure - a hub fan meeting a ring of
            # quads - and smooth shading across that junction prints a faint lens
            # inside the mouth that looks like the black and the red coming apart.
            # Borrowing the surface normal makes the decal shade exactly like the
            # face it sits on, so nothing of its construction shows at all.
            try:
                me.normals_split_custom_set_from_vertices(vnrm)
            except Exception:
                pass
PH["reseat_faces"] = reseat_faces

def rebuild_tongues(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_"), cut=0.52, inset=0.055):
    """Cut the tongue OUT of the mouth's own outline instead of floating a
    separate blob inside it.

    The red was a small dome roughly half the mouth's width, so black showed on
    both sides of it at its own height and it read as a spot sitting in the mouth
    rather than as the inside of the mouth. Deriving it from the mouth polygon -
    everything below a cut line, pulled in by a small margin - makes the red
    follow the black's lower curve exactly, so the two cannot disagree whatever
    the head shape is."""
    for tag in tags:
        mi = bpy.data.objects[tag+"FaceInk"].data
        mouth = None
        for g in _islands(mi):
            xs = [mi.vertices[i].co for i in g]
            zsp = max(p.z for p in xs)-min(p.z for p in xs)
            if zsp < 0.15 and sum(p.z for p in xs)/len(xs) < 1.30: mouth = g
        if mouth is None: continue
        P = [mi.vertices[i].co.copy() for i in mouth]
        c = sum(P, Vector())/len(P)
        n = Vector((0, 0, 0))
        for i in range(len(P)): n += (P[i]-c).cross(P[(i+1) % len(P)]-c)
        n.normalize()
        if n.dot(Vector((0, -1, 0))) < 0: n = -n
        # frame: v straight up the face, u across it
        up = Vector((0, 0, 1)); t2 = (up-n*up.dot(n)).normalized(); t1 = t2.cross(n).normalized()
        loop, _adj = _island_topology(mi, mouth)
        if len(loop) < 6: loop = mouth
        uv = [((mi.vertices[i].co-c).dot(t1), (mi.vertices[i].co-c).dot(t2)) for i in loop]
        vlo = min(q[1] for q in uv); vhi = max(q[1] for q in uv)
        vcut = vlo+(vhi-vlo)*cut
        poly = []
        m = len(uv)
        for i in range(m):
            a0 = uv[i]; a1 = uv[(i+1) % m]
            if a0[1] <= vcut: poly.append(a0)
            if (a0[1]-vcut)*(a1[1]-vcut) < 0:
                tt = (vcut-a0[1])/(a1[1]-a0[1])
                poly.append((a0[0]+(a1[0]-a0[0])*tt, vcut))
        if len(poly) < 4: continue
        cc = (sum(q[0] for q in poly)/len(poly), sum(q[1] for q in poly)/len(poly))
        poly = [(cc[0]+(q[0]-cc[0])*(1.0-inset), cc[1]+(q[1]-cc[1])*(1.0-inset)) for q in poly]
        bm = bmesh.new()
        hub = bm.verts.new(c+t1*cc[0]+t2*cc[1])
        ring = [bm.verts.new(c+t1*q[0]+t2*q[1]) for q in poly]
        for i in range(len(ring)-1):
            try: bm.faces.new((hub, ring[i], ring[i+1]))
            except ValueError: pass
        try: bm.faces.new((hub, ring[-1], ring[0]))
        except ValueError: pass
        for f in bm.faces: f.smooth = True
        bm.normal_update()
        ob = bpy.data.objects[tag+"Tongue"]
        mat = ob.data.materials[0] if ob.data.materials else None
        me = bpy.data.meshes.new(tag+"Tongue_mesh")
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        if mat: me.materials.append(mat)
        ob.data = me
        ob.vertex_groups.clear()
        ob.vertex_groups.new(name="head").add(list(range(len(me.vertices))), 1.0, 'REPLACE')
PH["rebuild_tongues"] = rebuild_tongues

def _disc(bm, c, t1, t2, outline, rings=3, hub=True):
    """Fill a 2D outline with a hub-and-rings mesh so every face is small."""
    cu = sum(q[0] for q in outline)/len(outline)
    cv = sum(q[1] for q in outline)/len(outline)
    layers = []
    for r in range(rings):
        k = (r+1)/float(rings)
        layers.append([bm.verts.new(c+t1*(cu+(q[0]-cu)*k)+t2*(cv+(q[1]-cv)*k))
                       for q in outline])
    h = bm.verts.new(c+t1*cu+t2*cv)
    m = len(outline)
    for i in range(m):
        j = (i+1) % m
        try: bm.faces.new((h, layers[0][i], layers[0][j]))
        except ValueError: pass
    for r in range(rings-1):
        for i in range(m):
            j = (i+1) % m
            try: bm.faces.new((layers[r][i], layers[r][j], layers[r+1][j], layers[r+1][i]))
            except ValueError: pass
    return layers[-1]

def mouth_outline(a=0.1047, h=0.0719, n=64, p=0.52):
    """The original mouth, measured off the old mesh: straight top edge, half
    ellipse below it, 0.209 wide and 0.072 deep. The exponent 0.52 reproduces the
    old vertices to a thousandth."""
    out = []
    half = n//2
    for i in range(half+1):
        u = -a+2*a*i/half
        k = max(0.0, 1.0-(u/a)**2)
        out.append((u, -h*(k**p)))
    for i in range(1, half):
        out.append((a-2*a*i/half, 0.0))
    return out

def tongue_outline(a=0.047, b=0.0160, drop=0.0468, n=40):
    """The original tongue: a small rounded oval centred low in the mouth, with
    black still showing to each side of it and below it. Clipping the mouth's own
    outline instead made a red band that reached the full width, which is not the
    shape and is why it kept looking wrong."""
    return [(a*math.sin(2*math.pi*i/n), -drop+b*math.cos(2*math.pi*i/n)) for i in range(n)]

# Height of the mouth's top edge on each face, measured off the version that
# looked right. The eye ring is not a usable landmark for this: the eyes sit at
# different heights relative to the chin from character to character, so a single
# offset below them put two of the mouths under the jaw, where the face turns
# away and the decal foreshortens into a slot.
MOUTH_TOP = {"": 1.2018, "Juno_": 1.1820, "Wren_": 1.2170, "Sage_": 1.2130, "Tobi_": 1.1950}
PH["MOUTH_TOP"] = MOUTH_TOP

def rebuild_mouths(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Rebuild the mouth and tongue, and put them back where they belong.

    The mouth also has to be ANCHORED. Centring the new outline on the old
    island's centroid dropped it, because the new shape hangs entirely below its
    top edge while the old one straddled its centre - that is why the mouths
    slid down onto the jaw. The eye ring has never been rebuilt, so its lower
    edge is a stable landmark: on the original face the mouth's top edge sits
    0.052 below it, scaled by the head."""
    for tag in tags:
        ink = bpy.data.objects[tag+"FaceInk"]
        me = ink.data
        old = None; ring_lo = None; ring_w = None
        for g in _islands(me):
            xs = [me.vertices[i].co for i in g]
            zsp = max(p.z for p in xs)-min(p.z for p in xs)
            if zsp < 0.15 and sum(p.z for p in xs)/len(xs) < 1.30: old = g
            elif zsp > 0.23:
                lo = min(p.z for p in xs)
                if ring_lo is None or lo < ring_lo:
                    ring_lo = lo; ring_w = max(p.x for p in xs)-min(p.x for p in xs)
        if old is None: continue
        s = (ring_w/0.228) if ring_w else 1.0  # eye ring width on the reference head
        shape = [(u*s, v*s) for u, v in mouth_outline()]
        red = [(u*s, v*s) for u, v in tongue_outline()]
        P = [me.vertices[i].co.copy() for i in old]
        cen = sum(P, Vector())/len(P)
        # Take the frame from the FACE, by casting at the mouth's height, not from
        # the island's vertex order. The island is a disc whose vertices come back
        # in whatever order the flood fill found them, so summing cross products
        # round that list gives a random direction - which is what tipped the
        # mouth over and squashed it onto the jaw.
        ztop = MOUTH_TOP.get(tag, 1.206)
        zc = ztop-0.035*s
        body = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"].data
        btree = BVHTree.FromPolygons([v.co.copy() for v in body.vertices],
                                     [list(q.vertices) for q in body.polygons])
        hit = btree.ray_cast(Vector((0.0, -1.2, zc)), Vector((0, 1, 0)), 3.0)
        if hit[0] is None: continue
        n = Vector((0, -1, 0)); t2 = Vector((0, 0, 1)); t1 = Vector((1, 0, 0))
        c = Vector((0.0, hit[0].y, ztop))
        bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in old], context='VERTS')
        _disc(bm, c, t1, t2, shape, rings=4)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        for f in bm.faces: f.smooth = True
        bm.normal_update(); bm.to_mesh(me); bm.free()
        me.update()
        ink.vertex_groups.clear()
        ink.vertex_groups.new(name="head").add(list(range(len(me.vertices))), 1.0, 'REPLACE')
        bm = bmesh.new()
        _disc(bm, c+n*0.002, t1, t2, red, rings=3)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        for f in bm.faces: f.smooth = True
        bm.normal_update()
        tob = bpy.data.objects[tag+"Tongue"]
        mat = tob.data.materials[0] if tob.data.materials else None
        tm = bpy.data.meshes.new(tag+"Tongue_mesh")
        bm.to_mesh(tm); bm.free()
        for q in tm.polygons: q.use_smooth = True
        if mat: tm.materials.append(mat)
        tob.data = tm
        tob.vertex_groups.clear()
        tob.vertex_groups.new(name="head").add(list(range(len(tm.vertices))), 1.0, 'REPLACE')
PH["rebuild_mouths"] = rebuild_mouths
PH["mouth_outline"] = mouth_outline

def round_balls(tag, groups=("hand.L", "hand.R"), power=1.0):
    """Make the ball parts actually spherical by fitting a sphere and snapping to it.

    Relaxation was the wrong tool here. Smoothing a coarse ball evens out the
    local differences but also eats the shape, so the hands came out faceted and
    slightly square instead of round. A hand IS a sphere, so fit one by least
    squares to the vertices the hand bone owns and project them onto it, blended
    by bone weight so the wrist still meets the arm."""
    ob = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
    me = ob.data
    gi = {g.name: g.index for g in ob.vertex_groups}
    out = {}
    for gname in groups:
        if gname not in gi: continue
        idx = gi[gname]
        ws = {}
        for v in me.vertices:
            for g in v.groups:
                if g.group == idx and g.weight > 0.05: ws[v.index] = g.weight
        core = [me.vertices[i].co.copy() for i, w in ws.items() if w > 0.75]
        if len(core) < 12: continue
        # algebraic sphere fit: 2p.c + (R^2-|c|^2) = |p|^2
        n = len(core)
        S = [[0.0]*5 for _ in range(4)]
        for p in core:
            row = [2*p.x, 2*p.y, 2*p.z, 1.0, p.length_squared]
            for a in range(4):
                for b in range(5): S[a][b] += row[a]*row[b]
        for col in range(4):                       # gaussian elimination
            piv = max(range(col, 4), key=lambda r: abs(S[r][col]))
            S[col], S[piv] = S[piv], S[col]
            if abs(S[col][col]) < 1e-12: break
            f = S[col][col]
            S[col] = [x/f for x in S[col]]
            for r in range(4):
                if r == col: continue
                f = S[r][col]
                if f: S[r] = [a-f*b for a, b in zip(S[r], S[col])]
        c = Vector((S[0][4], S[1][4], S[2][4]))
        R2 = S[3][4]+c.length_squared
        if R2 <= 0: continue
        R = math.sqrt(R2)
        moved = 0.0
        for i, w in ws.items():
            p = me.vertices[i].co
            d = p-c
            if d.length < 1e-6: continue
            k = ss((w-0.30)/0.60)**power   # fully spherical wherever the bone owns it
            tgt = c+d.normalized()*R
            me.vertices[i].co = p.lerp(tgt, k)
            moved = max(moved, (me.vertices[i].co-p).length)
        out[gname] = (round(R, 4), round(moved, 4))
    me.update()
    return out
PH["round_balls"] = round_balls

def clean_weights(tags=("", "Juno_", "Wren_", "Sage_", "Tobi_")):
    """Stop one body part being skinned to another part's bone.

    The body is 18 separate primitives, but the weights were painted as if it were
    one skin, so 38 vertices of the HEAD carried up to 0.72 of arm weight and 22
    vertices of the TORSO carried up to 0.33 - all of them at the shoulder corner,
    z about 1.1. Lift an arm and those vertices are dragged with it: the torso
    spikes into a triangle at the shoulder and the jaw pulls sideways. A lunge
    does the same thing to the flank and the jaw line.

    Each island may only be weighted to the bones its own part belongs to.
    Everything else is removed and what is left is renormalised, so the shape of
    the deformation inside each part is untouched."""
    LIMB = {
        "head":  ("head",),
        "torso": ("chest", "spine", "hips", "neck"),
        "hips":  ("hips", "spine"),
        "arm":   ("shoulder.{S}", "upperarm.{S}", "forearm.{S}"),
        "hand":  ("hand.{S}", "forearm.{S}"),
        "fore":  ("forearm.{S}",),
        "leg":   ("thigh.{S}", "shin.{S}", "hips"),
        "foot":  ("foot.{S}",),
    }
    def kind(c, n):
        x, z = c.x, c.z
        if z > 1.30: return "head"
        if z > 1.08 and abs(x) < 0.25: return "torso"
        if abs(x) > 0.25 and z > 0.84: return "arm"
        if abs(x) > 0.25 and z > 0.70: return "fore"
        if abs(x) > 0.25: return "hand"
        if z > 0.70: return "torso"
        if z > 0.55: return "hips"
        if z > 0.18: return "leg"
        return "foot"
    rep = {}
    for tag in tags:
        ob = bpy.data.objects[(tag+"Kindred_Body") if tag else "Kindred_Body"]
        me = ob.data
        gi = {g.name: g.index for g in ob.vertex_groups}
        groups = {g.index: g for g in ob.vertex_groups}
        stripped = 0
        for g in _islands(me):
            P = [me.vertices[i].co for i in g]
            c = sum(P, Vector())/len(P)
            k = kind(c, len(g))
            S = "L" if c.x >= 0 else "R"
            ok = {gi[n.replace("{S}", S)] for n in LIMB[k] if n.replace("{S}", S) in gi}
            for i in g:
                v = me.vertices[i]
                keep = [(e.group, e.weight) for e in v.groups if e.group in ok and e.weight > 0.0005]
                drop = [e.group for e in v.groups if e.group not in ok]
                if not keep:
                    keep = [(min(ok), 1.0)]
                tot = sum(w for _, w in keep)
                for gidx in drop:
                    groups[gidx].remove([i]); stripped += 1
                for gidx, w in keep:
                    groups[gidx].add([i], w/tot, 'REPLACE')
        me.update()
        rep[tag or "kai"] = stripped
    return rep
PH["clean_weights"] = clean_weights
