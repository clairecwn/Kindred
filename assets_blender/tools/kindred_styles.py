"""Per-character hair styling for Kindred. Load after kindred_hair.py, then
call PH['build_all']()."""
import bpy, math
PH = bpy.app.driver_namespace["PH"]
fly = PH["flyaway"]; tube = PH["tube"]; dense = PH["dense_path"]
scale = PH["scale_mesh"]; join = PH["join_meshes"]

SHORT = dict(NCOL=96, NSCALP=22, NFALL=22, locks=7, lock_amp=0.042, lock_z=0.030,
             scalp_rip=0.013, curl_amp=0.030, curl_len=0.34, twist=0.026,
             swell=0.08, taper=0.35, drift=0.05, nape=0.05, tip_taper=0.34, tip_span=0.09, volume=0.000, flow=0.045)
TOUSLE = dict(NCOL=100, NSCALP=22, NFALL=22, locks=9, lock_amp=0.046, lock_z=0.036,
              scalp_rip=0.013, curl_amp=0.034, curl_len=0.26, twist=0.034,
              swell=0.08, taper=0.35, drift=0.05, nape=0.05, tip_taper=0.34, tip_span=0.09, volume=0.000, flow=0.045)
JKW = dict(NCOL=100, NSCALP=22, NFALL=24, locks=7, lock_amp=0.048, lock_z=0.034,
           scalp_rip=0.013, curl_amp=0.036, curl_len=0.32, twist=0.032,
           swell=0.09, taper=0.40, drift=0.06, nape=0.03, tip_taper=0.34, tip_span=0.10, volume=0.000, flow=0.060)
SKW = dict(NCOL=100, NSCALP=22, NFALL=24, locks=7, lock_amp=0.047, lock_z=0.032,
           scalp_rip=0.013, curl_amp=0.035, curl_len=0.32, twist=0.030,
           swell=0.09, taper=0.40, drift=0.05, nape=0.03, tip_taper=0.34, tip_span=0.10, volume=0.000, flow=0.060)
WKW = dict(NCOL=112, NROW=76, NSCALP=22, NFALL=26, locks=7, lock_amp=0.040, lock_z=0.046,
           scalp_rip=0.013, curl_amp=0.128, curl_len=0.50, twist=0.140,
           swell=0.07, taper=0.26, drift=0.12, nape=0.00, fdrift=0.07, flow=0.125, wave_at=0.08, curl_on=0.24, wave_phase=1.30, tip_taper=0.18, tip_span=0.10, volume=0.000)

KAI_END = [(0,1.722),(25,1.706),(45,1.646),(60,1.520),(75,1.392),(90,1.280),(110,1.196),(140,1.152),(180,1.144)]
TOBI_END = [(0,1.718),(25,1.704),(45,1.644),(62,1.508),(80,1.352),(100,1.240),(130,1.164),(160,1.143),(180,1.140)]
# A ponytail does NOT mean a short hem all round. The cap still has to cover the
# whole skull to the nape, or the back of the head goes bald - these characters
# have no neck, so the hair is the back of the head. What makes it read as "up"
# is the SIDES being swept clear of the jaw and a tail that breaks the outline,
# not the back being cut away. So: high at the ears, sweeping down to full
# coverage at the back centre.
JUNO_END = [(0,1.716),(18,1.706),(34,1.660),(48,1.596),(60,1.522),(72,1.454),
            (88,1.418),(104,1.378),(120,1.296),(140,1.210),(160,1.166),(180,1.152)]
SAGE_END = [(0,1.716),(22,1.704),(42,1.648),(58,1.570),(68,1.480),(78,1.360),(92,1.264),(115,1.190),(150,1.154),(180,1.149)]
# Her hemline used to fall 0.60 between 60 and 78 degrees, which is about six
# columns. Every column is resampled along its own length, so six neighbours with
# wildly different lengths put their rows at wildly different heights and the
# quads between them come out long and skewed. Measured dihedral angles there
# reached 172 degrees, which is a fold, and that is the wrinkling down the sides
# of her hair. The same total drop spread over twice the arc keeps the shape and
# removes the skew.
WREN_END = [(0,1.726),(12,1.712),(26,1.674),(38,1.618),(48,1.552),(56,1.470),
            (64,1.372),(72,1.248),(80,1.112),(88,0.972),(96,0.846),(106,0.742),
            (118,0.666),(132,0.614),(150,0.582),(180,0.572)]

def kai_tufts():
    a = fly([((0.04,-0.30,1.788),0.046),((0.14,-0.335,1.845),0.040),
             ((0.25,-0.335,1.888),0.028),((0.34,-0.305,1.902),0.012),((0.39,-0.28,1.905),0.003)])
    b = fly([((-0.13,-0.25,1.800),0.036),((-0.23,-0.285,1.850),0.028),
             ((-0.32,-0.275,1.872),0.015),((-0.37,-0.245,1.876),0.003)])
    join(a,[b]); return a

def tobi_tufts():
    specs = [((-0.05,-0.30,1.800),(-0.16,-0.33,1.862),(-0.28,-0.325,1.900),(-0.36,-0.295,1.912)),
             ((0.16,-0.26,1.806),(0.27,-0.28,1.862),(0.37,-0.26,1.890),(0.43,-0.235,1.896)),
             ((0.02,0.05,1.880),(0.06,0.16,1.930),(0.08,0.27,1.952),(0.08,0.34,1.958))]
    r = [0.044,0.034,0.018,0.003]
    parts = [fly([(s[i], r[i]) for i in range(4)]) for s in specs]
    base = parts[0]; join(base, parts[1:]); return base

def juno_extras():
    """ONE tail with strand relief cut into its surface, not three tubes.

    Three separate hanks gave three separate silhouettes, so it read as three
    ponytails tied together rather than one thick one. A ponytail is a single
    mass; what makes it look like hair is relief ON that mass - a few strand
    ridges spiralling down it as the hair twists. So: one swept tube whose
    cross-section carries three lobes, rotating slowly along its length, with a
    finer break-up on top and a gentle pulse in thickness."""
    # round section, not flattened: scaled across, the three lobes collapse into
    # one flat blade and the strand relief disappears with them
    # Thick AND not a coil: the grooves give the strand read, the thickness comes
    # back to where it was, and the taper is even the whole way down so there is
    # no bulge at the top to narrow away from.
    st = [((0,0.228,1.782),0.112),((0,0.300,1.868),0.142),((0,0.392,1.926),0.162),
          ((0,0.498,1.952),0.173),((0,0.606,1.944),0.178),((0,0.706,1.898),0.178),
          ((0,0.786,1.812),0.176),((0,0.838,1.700),0.173),
          ((0,0.842,1.558),0.164),((0,0.862,1.366),0.153),((0,0.852,1.180),0.139),
          ((0,0.828,1.012),0.121),((0,0.802,0.882),0.100),((0,0.780,0.792),0.076),
          ((0,0.764,0.734),0.052),((0,0.754,0.700),0.030),((0,0.748,0.682),0.012)]
    def b(u, th):
        return (-0.085*(0.5-0.5*math.cos(4*th))
                - 0.035*(0.5-0.5*math.cos(7*th+1.2))
                + 0.018*math.sin(4*math.pi*u))
    tail = scale(tube(dense(st, 76), segs=36, bulge=b), sx=1.06)
    tie = scale(tube([((0,0.260,1.834),0.126),((0,0.322,1.900),0.136)], segs=24), sx=1.14)
    join(tail, [tie]); return tail

def wren_extras():
    a = fly([((0.17,-0.30,1.690),0.040),((0.26,-0.335,1.742),0.032),
             ((0.34,-0.330,1.772),0.017),((0.39,-0.305,1.780),0.003)])
    b = fly([((-0.20,-0.27,1.664),0.034),((-0.29,-0.300,1.712),0.026),
             ((-0.36,-0.292,1.738),0.013),((-0.40,-0.268,1.744),0.003)])
    join(a,[b]); return a

def sage_extras():
    st = [((0.34,0.10,1.44),0.070),((0.43,-0.06,1.30),0.092),((0.44,-0.20,1.14),0.098),
          ((0.39,-0.30,0.99),0.092),((0.31,-0.35,0.86),0.078),((0.25,-0.36,0.75),0.056),
          ((0.21,-0.35,0.67),0.030),((0.19,-0.34,0.62),0.010)]
    b = lambda t,th: 0.24*math.sin(2*math.pi*6.0*t)+0.18*math.cos(2*(th-2*math.pi*1.6*t))
    braid = tube(dense(st,56), segs=20, bulge=b)
    return braid

SPECS = [
    dict(tag="",      k="kai",  ctrl=KAI_END,  kw=SHORT,
         bang=dict(n=2, amp=0.150, span=(4.0,64.0), phase=0.62, asym=0.034, sweep=0.26),
         flick=-0.22, flick_above=1.45, hat_squash=(1.70,1.852),
         bump_kw=dict(amp=0.003, freq=10.0, seed=1.0)),
    dict(tag="Tobi_", k="tobi", ctrl=TOBI_END, kw=TOUSLE,
         bang=dict(n=3, amp=0.118, span=(3.0,66.0), phase=0.30, asym=-0.026, sweep=-0.20),
         flick=-0.24, flick_above=1.45, hat_squash=(1.70,1.852),
         bump_kw=dict(amp=0.007, freq=7.0, seed=3.0)),
    dict(tag="Juno_", k="juno", ctrl=JUNO_END, kw=JKW, extras=[juno_extras],
         bang=dict(n=2, amp=0.116, span=(4.0,58.0), phase=0.95, asym=0.040, sweep=0.34),
         flick=-0.30, flick_above=1.45, hat_squash=(1.70,1.846)),
    dict(tag="Sage_", k="sage", ctrl=SAGE_END, kw=SKW, extras=[sage_extras],
         bang=dict(n=2, amp=0.128, span=(5.0,60.0), phase=0.20, asym=-0.024, sweep=-0.18),
         flick=-0.22, flick_above=1.45, hat_squash=(1.72,1.876)),
    dict(tag="Wren_", k="wren", ctrl=WREN_END, kw=WKW,
         bang=dict(n=1.5, amp=0.156, span=(3.0,46.0), phase=1.5708, asym=0.0, sweep=0.0),
         flick=-0.24, flick_above=1.50, hat_squash=(1.72,1.858), gap=0.022),
]
PH["SPECS"] = SPECS

def build_all(only=None):
    out = {}
    for s in SPECS:
        if only and s["k"] not in only: continue
        a = dict(s); tag = a.pop("tag"); k = a.pop("k"); ctrl = a.pop("ctrl"); kw = a.pop("kw")
        out[k] = PH["build_char"](tag, k, ctrl, kw, **a)
    return out
PH["build_all"] = build_all
