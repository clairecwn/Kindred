"""Pass 5: sea. The sea was a 2 km box, far beyond what the viewport (500 m) or a game camera draws, which left a grey
band at the horizon and wasted depth precision. It is now a 420 m disc with the same texture scale. The foam rings and
glints were round tubes (139,000 triangles between them); they are flat ribbons now (about 1,000)."""
import bpy, bmesh
from kk import *
BD = "KINGDOM_BACKDROP"
SUP = bpy.data.collections[SUPERSEDED]
KI("water")["gm_tile"] = 12.0                      # Codex's sea UVs were x/12, y/12
b = B(); R = 420.0; n = 64
b.prism([(R * cos(tau * i / n), R * sin(tau * i / n)) for i in range(n)], 0.4, "water", loc=(0, 0, -0.55))
put("K_Sea", kit("K_Sea", b), BD)
supersede([o for o in C(BD).objects if o.name == "Sea"])

def ribbon(t, pts, w, closed=False):
    """Flat strip along pts (list of Vector), half-width w (number or list). Open strips taper to a point."""
    n = len(pts); L = []; Rr = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if (i > 0 or closed) else p; c = pts[(i + 1) % n] if (i < n - 1 or closed) else p
        tan = (c - a); tan.z = 0; tan.normalize(); nor = Vector((-tan.y, tan.x, 0))
        ww = w[i] if isinstance(w, (list, tuple)) else w
        if ww <= 1e-6:
            v = t.verts.new(p); L.append(v); Rr.append(v)
        else:
            L.append(t.verts.new(p + nor * ww)); Rr.append(t.verts.new(p - nor * ww))
    for i in range(n if closed else n - 1):
        j = (i + 1) % n; vs = [L[i], L[j], Rr[j], Rr[i]]
        vs = [v for k, v in enumerate(vs) if v not in vs[:k]]
        if len(vs) >= 3: t.faces.new(vs)

def curve_pts(o):
    sp = o.data.splines[0]
    return [o.matrix_world @ p.co for p in sp.bezier_points], sp.use_cyclic_u, o.data.bevel_depth

t = bmesh.new(); k = 0
for o in sorted((o for o in SUP.objects if o.name.startswith("Sea_glint")), key=lambda o: o.name):
    (p0, p1, p2), _, bev = curve_pts(o); c = 2 * p1 - (p0 + p2) / 2
    pts = []
    for i in range(5):
        u = i / 4; q = (1 - u) ** 2 * p0 + 2 * u * (1 - u) * c + u * u * p2; q.z = -0.115; pts.append(q)
    ribbon(t, pts, [0, 0.05, 0.07, 0.05, 0]); k += 1
bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
for f in t.faces:
    if f.normal.z < 0: f.normal_flip()
b = B(); b._add(t, "foam"); me = kit("K_Sea_Glints", b)
for f in me.polygons:
    pass
put("K_Sea_Glints", me, BD)
t = bmesh.new(); rings = 0
for i, o in enumerate(sorted((o for o in SUP.objects if o.name.startswith("Shore_foam")), key=lambda o: o.name)):
    pts, cyc, bev = curve_pts(o)
    for p in pts: p.z = -0.13 + 0.006 * i
    ribbon(t, pts, bev * 1.5, closed=True); rings += 1
for f in t.faces: f.normal_update()
b = B(); b._add(t, "foam"); me = kit("K_Shore_Foam", b)
put("K_Shore_Foam", me, BD)
for name in ("K_Sea_Glints", "K_Shore_Foam"):
    me = bpy.data.objects[name].data
    import numpy as np
    nz = np.empty(len(me.polygons) * 3, dtype=np.float32); me.polygons.foreach_get("normal", nz)
    if nz.reshape(-1, 3)[:, 2].mean() < 0: me.flip_normals()
for m in list(bpy.data.meshes):
    if m.users == 0 and m.name.startswith(("K_Sea_Glints", "K_Shore_Foam", "K_Sea")): bpy.data.meshes.remove(m)
for o in bpy.context.scene.objects:
    if o.type == "CAMERA": o.data.clip_start = 0.1; o.data.clip_end = 2000
for o in C(BD).objects: o.visible_shadow = False
report(glints=k, foam_rings=rings, tris={n: tris(bpy.data.objects[n].data) for n in ("K_Sea", "K_Sea_Glints", "K_Shore_Foam")})
