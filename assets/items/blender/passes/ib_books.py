"""Book Burrow: books that stand on a table or a shelf, cover to the front."""
from ii import *
from ip import *

def disc_emblem(b, y, z, R=0.078, m="cream"):
    b.prism(circle(R, 20), 0.012, m, mtx=XZ(y - 0.008, 0, z))

@item("boo-fieldguide", "Grove Field Guide", "book-burrow", "table", (0.5, 0.5))
def fieldguide(b):
    """A thick green guide with two leaves on a cream disc and a strap."""
    def em(b, y, z): disc_emblem(b, y, z); leaves_at(b, y - 0.012, z, 0.09, "leaf_dark")
    book(b, V("A", "green"), 0.28, 0.1, 0.36, em, strap="cream")

@item("boo-storybook", "Lanternfall Stories", "book-burrow", "table", (0.5, 0.5))
def storybook(b):
    """A tall navy storybook: a glowing lantern on the cover with fireflies round it, and a ribbon marker."""
    def em(b, y, z):
        b.ball(1.0, (0, y - 0.004, z), "yolk", sc=(0.05, 0.014, 0.062), u=12, v=8)
        for dz in (-0.066, 0.066): b.box((0.05, 0.016, 0.016), (0, y - 0.004, z + dz), "gold")
        b.box((0.012, 0.012, 0.03), (0, y - 0.002, z + 0.085), "gold")
        for dx, dz in ((-0.09, 0.07), (0.09, 0.04), (-0.07, -0.08), (0.08, -0.1), (0.0, -0.13)): stud(b, (dx, y, z + dz), (0, -1, 0), 0.013, "glow")
    book(b, V("A", "navy"), 0.32, 0.085, 0.4, em, mark="yellow")

@item("boo-sketchbook", "Pocket Sketchbook", "book-burrow", "table", (0.5, 0.5))
def sketchbook(b):
    """A wide kraft sketchbook bound with rings along the top, a bloom sticker, and a pencil across the front."""
    b.box((0.36, 0.05, 0.27), (0, 0, 0.135), tn("paper", 0.2, None))
    b.box((0.37, 0.014, 0.28), (0, -0.03, 0.14), tn("kraft", 0.16, 0.86), r=0.007, seg=1); b.box((0.37, 0.014, 0.28), (0, 0.03, 0.14), "kraft_dk", r=0.007, seg=1)
    for i in range(8):
        sub(b, lambda sb: sb.tube(ring(0, 0, 0, 0.036, 8, "xz"), 0.008, "steel", seg=5, closed=True), xf((-0.14 + 0.04 * i, 0, 0.272), (0, 0, pi / 2)))
    bloom_at(b, (0.08, -0.04, 0.175), 0.05, "cream", "gold", 6)
    b.cyl(0.016, 0.24, (-0.12, -0.052, 0.06), "yellow", seg=6, rot=(0, pi / 2, 0)); b.cyl(0.017, 0.03, (-0.15, -0.052, 0.06), "pink", seg=6, rot=(0, pi / 2, 0))
    b.cyl(0.016, 0.04, (0.12, -0.052, 0.06), "trunk_light", seg=6, r2=0.003, rot=(0, pi / 2, 0))
    for x in (-0.07, 0.07): b.box((0.02, 0.012, 0.05), (x, -0.062, 0.06), "plum")

@item("boo-cookbook", "Hearthlight Recipes", "book-burrow", "table", (0.5, 0.5))
def cookbook(b):
    """A fat red cookbook with a heart on a cream disc and a yellow ribbon marker."""
    def em(b, y, z): disc_emblem(b, y, z, 0.085); heart_at(b, y - 0.012, z, 0.048, "red")
    book(b, V("A", "red"), 0.3, 0.11, 0.36, em, mark="yellow")

@item("boo-journal", "Clothbound Journal", "book-burrow", "table", (0.5, 0.5))
def journal(b):
    """A small lilac journal with a bloom on the cover, held shut by a rose strap with a gold clasp."""
    book(b, V("A", "lilac"), 0.25, 0.085, 0.33, lambda b, y, z: bloom_at(b, (-0.02, y - 0.004, z), 0.06, "cream", "gold", 6), strap="rose")
    stud(b, (0.065, -0.05, 0.165), (0, -1, 0), 0.024, "gold")
