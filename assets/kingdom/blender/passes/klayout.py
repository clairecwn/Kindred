"""Laying land out from kit parts, by the rules the game uses. A Land is a set of 1 m cells that can be built on (read
from kingdom_collision.json) and a record of what stands on each cell. Every part is put down through it, so a layout
is checked as it is made: a part on a cell that is not open lawn, two parts on one cell, a part on a path, a part in
the way of a flight of steps or a bridge. k26_showcase.py builds the showcase island with it.

A cell is named by the Blender x and y of its lower left corner: cell (i, j) covers x i..i+1 and y j..j+1. The game
names the same cell [i, -(j + 1)], because game z = -Blender y.
A quarter turn is 90 degrees counter-clockwise seen from above; parts are drawn with their front to -Y."""
import bpy, json, base64, os, random
import numpy as np
from kk import *
import ktone, khouse
from ktone import shade, paint
from khouse import SIZES, BASE, sockets
from math import atan2, hypot, floor

SIDES = [((0, -1), 0.0), ((1, 0), pi / 2), ((0, 1), pi), ((-1, 0), -pi / 2)]      # a side of a cell, and the turn that brings a part drawn on -Y to it
PROUD = 0.03      # a plant stands this far above its bed's soil: a crop's own mound of earth is nearly level, and where it cut
                  # through the bed's paler patch of soil the two flickered over a hand's width
LIFT = 0.012      # a path tile that laps the world's own path is laid this much higher, for the same reason
RAILS = [((1, 0), 0.0), ((0, 1), pi / 2), ((-1, 0), pi), ((0, -1), -pi / 2)]      # a neighbour, and the turn that points a rail (drawn towards +X) at it

def _runs(s, n):
    b = base64.b64decode(s); a = np.repeat(np.frombuffer(b[0::2], dtype=np.uint8), np.frombuffer(b[1::2], dtype=np.uint8)); assert len(a) == n; return a
def read_island(path=None):
    """The baked home island as four sets of 1 m cells: lawn (can be built on), tile (a path tile can go here: open
    flat ground that is lawn, or part lawn and part world path), spine (holds some of the world's own path) and walk
    (a walker fits)."""
    path = path or os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "kingdom_collision.json")
    c = json.load(open(path)); I = c["island"]; nx, nz = I["nx"], I["nz"]; n = nx * nz
    g = _runs(I["grid"], n).reshape(nz, nx); gr = _runs(I["ground"], n).reshape(nz, nx); sf = _runs(I["surface"], n).reshape(nz, nx)
    q = lambda a: a.reshape(nz // 4, 4, nx // 4, 4)
    open_ = (g & 1) == 0
    lawn = q(open_ & (sf == 1) & (gr == 0)).all(axis=(1, 3))
    tile = q(open_ & ((sf == 1) | (sf == 2)) & (gr < 6)).all(axis=(1, 3)) & q(sf == 1).any(axis=(1, 3))
    spine = q(sf == 2).any(axis=(1, 3)); walk = q(open_).sum(axis=(1, 3)) >= 12
    X0 = int(I["minX"]); Ytop = int(-I["minZ"])                 # row 0 is the cell just under Blender y = Ytop
    def cells(mask): return {(X0 + int(ix), Ytop - 1 - int(iz)) for iz, ix in zip(*np.nonzero(mask))}
    return dict(lawn=cells(lawn), tile=cells(tile), spine=cells(spine), walk=cells(walk))

def read_sections(path=None):
    """What k28_sections wrote: {cell: section} for every cell that can be built on (0 is the start area), and the
    list of sections."""
    path = path or os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "kingdom_sections.json")
    d = json.load(open(path)); g = d["grid"]; a = _runs(g["data"], g["nx"] * g["nz"]).reshape(g["nz"], g["nx"]); Ytop = -g["minZ"]
    return {(g["minX"] + int(ix), Ytop - 1 - int(iz)): int(a[iz, ix]) - 1 for iz, ix in zip(*np.nonzero(a))}, d["sections"]
def show_wild(opened=()):
    """Tick the wild growth of every section but the opened ones (a list of section numbers)."""
    w = bpy.data.collections.get("KINGDOM_WILD")
    if w is None: return
    show_collection("KINGDOM_WILD", True)
    for ch in w.children: show_collection(ch.name, int(ch.name[3:]) not in set(opened))

class Land:
    def __init__(self, coll, tag, island, z=Z, seed=11, origin=(0, 0)):
        """origin: a layout is written in its own cells; origin is where its cell (0, 0) lies on the island, so a whole
        layout can be moved by changing one pair of numbers. Everything recorded and checked is in island cells."""
        self.c = coll; self.tag = tag; self.z = z; self.isl = island; self.n = 0; self.rnd = random.Random(seed); self.ox, self.oy = origin
        self.solid = {}; self.path = {}; self.water = set(); self.over = {}; self.gate = set(); self.reserved = {}
        self.problems = []; self.pieces = []; self.wild = []; self.fences = []; self.buildings = []; self.fronts = []; self.path_sets = {}; self.pond_cells = []; self.life = []
    # ------------------------------------------------------------ book-keeping
    def bad(self, what, name, cell): self.problems.append("%s: %s at cell %s" % (name, what, list(cell)))
    def claim(self, cells, name, kind="solid", under=False):
        for c in cells:
            if kind == "path":
                if c not in self.isl["tile"]: self.bad("a path tile is not on open flat ground", name, c)
                if c in self.solid or c in self.water: self.bad("a path runs into " + str(self.solid.get(c, "water")), name, c)
                self.path[c] = name; continue
            if c not in self.isl["lawn"] and not (kind == "porch" and c in self.isl["tile"]): self.bad("not open lawn", name, c)      # a porch may stand on the end of the world's path
            if kind == "water":
                if c in self.solid or c in self.path: self.bad("water runs into " + str(self.solid.get(c) or self.path.get(c)), name, c)
                self.water.add(c)
            elif kind == "over":                       # an arch or a pergola: things may pass or stand under it
                if c in self.solid: self.bad("stands over " + self.solid[c], name, c)
                self.over[c] = name
            elif kind == "afloat":                     # a lily pad: only on water
                if c not in self.water: self.bad("is not on water", name, c)
            else:
                if c in self.solid: self.bad("shares a cell with " + self.solid[c], name, c)
                if c in self.path: self.bad("stands on a path", name, c)
                if c in self.water: self.bad("stands in water", name, c)
                if c in self.over and not under: self.bad("stands under " + self.over[c], name, c)
                if c in self.reserved: self.bad("is in the way of " + self.reserved[c], name, c)
                self.solid[c] = name
                if kind == "gate": self.gate.add(c)
    def reserve(self, x, y, r, why):
        """Keep the cells within r of a point clear of anything solid (the top of a flight of steps, a bridge head)."""
        for i in range(floor(x - r), floor(x + r) + 1):
            for j in range(floor(y - r), floor(y + r) + 1):
                if hypot(i + 0.5 - x, j + 0.5 - y) <= r: self.reserved[(i, j)] = why
    def obj(self, mesh, loc, rz=0.0, parent=None, sc=1.0, label=None):
        self.n += 1; me = bpy.data.meshes[mesh] if isinstance(mesh, str) else mesh
        o = bpy.data.objects.new("%s_%03d_%s" % (self.tag, self.n, label or me.name[3:]), me); self.c.objects.link(o)
        o.location = loc; o.rotation_euler = (0, 0, rz); o.scale = (sc, sc, sc)
        if parent: o.parent = parent
        return o
    # ------------------------------------------------------------ parts
    def put(self, mesh, i, j, q=0, kind="solid", cells=None, under=False, plants=None):
        """One part with its lower left cell at (i, j) after q quarter turns. Returns the object."""
        me = bpy.data.meshes[mesh]; w, d = cells or me.get("kd_cells") or me.get("kh_cells") or (1, 1); w, d = int(w), int(d); i += self.ox; j += self.oy
        if q % 2: w, d = d, w
        o = self.obj(mesh, (i + w / 2, j + d / 2, self.z), q * pi / 2)
        self.claim([(a, b) for a in range(i, i + w) for b in range(j, j + d)], o.name, kind, under)
        rec = {"mesh": mesh, "cell": [i, -(j + d)], "cells": [w, d], "turns": q % 4, "x": o.location.x, "z": -o.location.y, "rot": round(q * pi / 2, 4), "kind": kind}
        if me.get("kd_leaf"):                          # a gate: its leaf hangs at the hinge, standing open
            h = me["kd_hinge"]; rz = q * pi / 2; lx = o.location.x + h[0] * cos(rz) - h[1] * sin(rz); ly = o.location.y + h[0] * sin(rz) + h[1] * cos(rz)
            self.obj(me["kd_leaf"], (lx, ly, self.z), rz + 0.9); rec["leaf"] = {"mesh": me["kd_leaf"], "x": round(lx, 3), "z": round(-ly, 3), "rot": round(rz + 0.9, 4)}
        if plants: rec["plants"] = self.plant(o, me, plants)
        self.pieces.append(rec); return o
    def plant(self, bed, me, spec):
        """Fill a bed: spec = (plant mesh or list of meshes, across, along, margin). Plants stand on the bed's soil."""
        names, nx_, ny_, margin = spec; names = [names] if isinstance(names, str) else list(names)
        sz, hx, hy = me["kd_soil"]; out = []; k = 0
        xs = [0.0] if nx_ == 1 else list(np.linspace(-(hx - margin), hx - margin, nx_)); ys = [0.0] if ny_ == 1 else list(np.linspace(-(hy - margin), hy - margin, ny_))
        for y in ys:
            for x in xs:
                m = names[k % len(names)]; k += 1; o = self.obj(m, (x, y, sz + PROUD), self.rnd.choice((0.0, pi / 2, pi, -pi / 2)), parent=bed, label="Plant")
                out.append({"mesh": m, "dx": round(float(x), 3), "dz": round(float(-y), 3), "y": round(float(sz + PROUD), 3), "rot": round(o.rotation_euler.z, 4)})
        return out
    def paths(self, sets):
        """Every path at once: sets = {surface: cells}. A tile in every cell, an edge on every open side, a corner where
        two open sides meet. A side is closed when the next cell is path of any surface, or the world's own path."""
        sets = {st: [(i + self.ox, j + self.oy) for i, j in cells] for st, cells in sets.items()}
        sets = {st: sorted(c for c in set(cells) if c in self.isl["tile"] or c not in self.isl["spine"]) for st, cells in sets.items()}   # a cell the world's path fills needs no tile
        for st, cells in sets.items(): self.claim(cells, st + " path", "path")
        for st, cells in sets.items(): self._tiles(cells, "KD_Path_" + st, "KD_Path_%s_Edge" % st, "KD_Path_%s_Corner" % st, None, set(self.path) | self.isl["spine"])
        self.path_sets = {st: [[i, -(j + 1)] for i, j in cells] for st, cells in sets.items()}
    def pond(self, cells):
        """Water, with a bank on every open side, a corner where two meet and an inner piece in every inside corner."""
        cells = sorted({(i + self.ox, j + self.oy) for i, j in cells}); self.claim(cells, "pond", "water"); self._tiles(cells, "KD_Pond_Water", "KD_Pond_Edge", "KD_Pond_Corner", "KD_Pond_Inner", set(self.water))
        self.pond_cells = [[i, -(j + 1)] for i, j in sorted(self.water)]
    def _tiles(self, cells, tile, edge, corner, inner, full):
        for (i, j) in cells:
            near = any((i + a_, j + b_) in self.isl["spine"] for a_ in (-1, 0, 1) for b_ in (-1, 0, 1))      # the world's path may reach a few centimetres into the next cell
            c = (i + 0.5, j + 0.5, self.z + (LIFT if near else 0.0)); self.obj(tile, c)
            open_ = [(i + dx, j + dy) not in full for (dx, dy), rz in SIDES]
            for k_, ((dx, dy), rz) in enumerate(SIDES):
                if open_[k_]: self.obj(edge, c, rz)
                (ex, ey), _ = SIDES[k_ - 1]
                if open_[k_] and open_[k_ - 1]: self.obj(corner, c, rz)
                elif inner and not open_[k_] and not open_[k_ - 1] and (i + dx + ex, j + dy + ey) not in full: self.obj(inner, c, rz)
    def fence(self, style, cells, gates=(), joins=()):
        """A post in every fence cell and a rail towards each neighbouring fence, gate or join. gates: (i, j, q)."""
        T = lambda c: (c[0] + self.ox, c[1] + self.oy); cells = [T(c) for c in cells]; joins = [T(c) for c in joins]; gw = [T(g) + (g[2],) for g in gates]      # gw: the gates in island cells
        cells = [c for c in cells if c not in {(g[0], g[1]) for g in gw}]; link = set(cells) | {(g[0], g[1]) for g in gw} | set(joins)
        self.claim(cells, style + " fence")
        for (i, j) in cells:
            c = (i + 0.5, j + 0.5, self.z); self.obj("KD_Fence_%s_Post" % style, c)
            for (dx, dy), rz in RAILS:
                if (i + dx, j + dy) in link: self.obj("KD_Fence_%s_Rail" % style, c, rz)
        for (i, j, q) in gates: self.put("KD_Gate_" + ("Ranch" if style == "Ranch" else "Picket"), i, j, q, kind="gate")
        self.fences.append({"style": style, "cells": [[i, -(j + 1)] for i, j in cells], "gates": [{"cell": [i, -(j + 1)], "turns": q} for i, j, q in gw]})
    # ------------------------------------------------------------ houses
    def _colours(self, roof="red", wall="cream", trim="wood", door="blue"):
        C_ = khouse.COLOURS; t = {}
        def variant(base, tag, hexcol):
            src = bpy.data.materials["KI_" + base]; n = "KX_%s_%s" % (base, tag); m = bpy.data.materials.get(n) or src.copy(); m.name = n; paint(m, hexcol); return m
        for k_, hx_ in zip(("roofA", "roofB", "roofC"), C_["roof"][roof]): t["KI_" + k_] = variant(k_, roof, hx_)
        for base, tag, hx_ in (("wallA", wall, C_["wall"][wall]), ("trimA", trim, C_["trim"][trim]), ("doorA", door, C_["door"][door])):
            t["KI_" + base] = variant(base, tag, hx_)
            for kind in ("dk", "lt"):
                if bpy.data.materials.get("KI_%s_%s" % (base, kind)): t["KI_%s_%s" % (base, kind)] = variant(base + "_" + kind, tag, shade(hx_, kind))
        return t
    def house(self, name, e, i, j, q=0):
        """A house from the house kit on a plot whose lower left cell is (i, j). e: size, roof, door, window, porch,
        chimney, timber and col (roof, wall, trim, door colours). The cells under its porch are taken too."""
        S = SIZES[e["size"]]; sk = sockets(S); P = S["plot"]; root = bpy.data.objects.new("%s_%s" % (self.tag, name), None); self.c.objects.link(root); i += self.ox; j += self.oy
        root.location = (i + P / 2, j + P / 2, self.z); root.rotation_euler = (0, 0, q * pi / 2); root.empty_display_size = 0.5; objs = []
        def add(mesh, sock, tag):
            o = bpy.data.objects.new("%s_%s_%s" % (self.tag, name, tag), bpy.data.meshes[mesh]); self.c.objects.link(o); o.parent = root
            o.location = sock[:3]; o.rotation_euler = (0, 0, sock[3] if len(sock) > 3 else 0.0); objs.append(o); return o
        add("KH_Body_" + e["size"], [0, 0, 0, 0], "Body")
        if e.get("timber"): add("KH_Timber_" + e["size"], [0, 0, 0, 0], "Timber")
        rm = "KH_Roof_%s_%s" % (e["roof"], e["size"]); add(rm, sk["roof"], "Roof")
        add("KH_Door_" + e["door"], sk["door"], "Door"); porch = add("KH_Porch_" + e["porch"], sk["porch"], "Porch")
        for k_, w in enumerate(sk["windows"]): add("KH_Window_" + e["window"], w, "Window_%d" % k_)
        if e.get("chimney"):
            c = bpy.data.meshes[rm]["kh_chimney"]; add("KH_Chimney_" + e["chimney"], [c[0], c[1], sk["roof"][2] + c[2], 0.0], "Chimney")
        dh = 1.3 if e["door"] == "Double" else 0.95; wi = (min(abs(u) for u in S["front"]) - 0.68) if S["front"] else S["hx"] - S["rc"]
        if wi - dh >= 0.45: add("KH_Lantern", [(dh + wi) / 2, sk["door"][1], BASE + 1.9, 0.0], "Lantern")
        table = self._colours(**e.get("col", {}))
        for o in objs:
            for sl in o.material_slots:
                if sl.material and sl.material.name in table: m = table[sl.material.name]; sl.link = "OBJECT"; sl.material = m
        bpy.context.view_layer.update()
        cells = {(a, b) for a in range(i, i + P) for b in range(j, j + P)}
        lo, hi = wbb(porch)                                                  # the porch may reach past the plot: it takes every cell it covers by more than 0.35 m
        more = {(a, b) for a in range(floor(lo.x + 0.35), floor(hi.x - 0.35) + 1) for b in range(floor(lo.y + 0.35), floor(hi.y - 0.35) + 1)} - cells
        self.claim(sorted(cells), root.name); self.claim(sorted(more), root.name, "porch"); cells |= more
        fx, fy = sin(q * pi / 2), -cos(q * pi / 2)                                # the cell a walker stands on to use the door
        front = (floor(root.location.x + fx * (P / 2 + 0.5)), floor(root.location.y + fy * (P / 2 + 0.5)))
        while front in cells: front = (front[0] + round(fx), front[1] + round(fy))
        self.fronts.append((root.name + " door", front))
        self.buildings.append(dict({k_: v for k_, v in e.items() if k_ != "col"}, name=name, colours=e.get("col", {}), x=root.location.x, z=-root.location.y,
                                   rot=round(q * pi / 2, 4), turns=q % 4, plot=[i, -(j + P), P, P], cells=sorted([a, -(b + 1)] for a, b in cells)))
        return root
    # ------------------------------------------------------------ wild things
    def scatter(self, label, meshes, n, gap, clear=1, sc=(1.0, 1.0), zoff=0.0, takes=True, where=None):
        """n things on free lawn cells, at least `gap` from each other and `clear` cells from paths and from anything
        built. takes=False for grass tufts, which stand on a cell without taking it."""
        free = sorted(c for c in self.isl["lawn"] if c not in self.solid and c not in self.path and c not in self.water and c not in self.over and c not in self.reserved)
        busy = set(self.solid) | set(self.path) | self.water | set(self.over) | self.isl["spine"]
        if clear:
            free = [c for c in free if not any((c[0] + a, c[1] + b) in busy for a in range(-clear, clear + 1) for b in range(-clear, clear + 1))]
        if where: free = [c for c in free if where(c[0] + 0.5 - self.ox, c[1] + 0.5 - self.oy)]      # where() speaks the layout's own cells
        self.rnd.shuffle(free); done = 0; spots = getattr(self, "_spots", []); self._spots = spots
        for (i, j) in free:
            if done >= n: break
            x, y = i + 0.5, j + 0.5
            if not takes: x += self.rnd.uniform(-0.3, 0.3); y += self.rnd.uniform(-0.3, 0.3)
            if any(hypot(x - px, y - py) < (gap + g) / 2 for px, py, g in spots): continue
            m = meshes[done % len(meshes)]; s_ = self.rnd.uniform(*sc); rz = self.rnd.uniform(0, tau)
            o = self.obj(m, (x, y, self.z + zoff), rz, sc=s_, label=label); spots.append((x, y, gap)); done += 1
            if takes: self.claim([(i, j)], o.name)
            self.wild.append({"mesh": m, "x": round(x, 3), "z": round(-y, 3), "rot": round(rz, 4), "scale": round(s_, 3), "takes": takes})
        return done
    def live(self, mesh, x, y, h=0.0, rz=0.0, sc=1.0, world=False):
        """A creature, a puff of smoke, a ripple, a boat: something that moves, so it takes no cell. h is its height
        above the lawn (the sea is 2.15 m below it). On the ground it may not stand inside something built.
        world=True: x and y are a place on the island (a pier, a chimney), not in the layout's own cells."""
        if not world: x += self.ox; y += self.oy
        c = (floor(x), floor(y))
        if h == 0.0 and (c in self.solid or c in self.water or c not in self.isl["walk"]): self.bad("stands where it cannot walk", mesh, c)
        if h == 0.0 and getattr(self, "closed", None) and c in self.closed: self.bad("stands on land that is not opened", mesh, c)
        o = self.obj(mesh, (x, y, self.z + h), rz, sc=sc)
        self.life.append({"mesh": mesh, "x": round(x, 3), "z": round(-y, 3), "y": round(h, 3), "rot": round(rz, 4), "scale": round(sc, 3)}); return o
    # ------------------------------------------------------------ checks
    def reach(self, start, targets):
        """Walks the land a cell at a time from `start` and reports every target that cannot be reached."""
        ok = lambda c: c in self.isl["walk"] and (c not in self.solid or c in self.gate) and c not in self.water
        seen = {start}; todo = [start]
        while todo:
            i, j = todo.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c = (i + dx, j + dy)
                if c not in seen and ok(c): seen.add(c); todo.append(c)
        for name, c in targets:
            if c not in seen: self.problems.append("%s cannot be reached (cell %s)" % (name, list(c)))
        return len(seen)
