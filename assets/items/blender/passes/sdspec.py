"""Shop display stands: the sizes and the surfaces items stand on. Plain Python (no bpy), so the Blender builder
(i12_display.py) and the layout script (assets/items/shop_displays.py) read the same numbers.
Every stand is drawn with the floor at z = 0, its middle at the origin and its front towards -Y."""
TOP = 0.78           # height of a table top
STEP = 0.2           # the back riser of a table stands this much higher
PLINTH = 0.14        # height of a plinth or a stage
STANDS = {
    "SD_Table_S": {"kind": "table", "size": [1.6, 0.95, TOP + STEP]},
    "SD_Table_M": {"kind": "table", "size": [2.2, 0.95, TOP + STEP]},
    "SD_Round": {"kind": "round", "size": [1.2, 1.2, 1.0]},
    "SD_Plinth": {"kind": "plinth", "size": [1.2, 1.2, PLINTH]},
    "SD_Plinth_Wide": {"kind": "plinth", "size": [2.4, 0.8, PLINTH]},
    "SD_Stage": {"kind": "plinth", "size": [3.0, 1.4, PLINTH]},
    "SD_Rack": {"kind": "rack", "size": [2.3, 0.8, 1.1]},
    "SD_Head": {"kind": "head", "size": [0.6, 0.6, 1.32]},
}
ROWS = {"front": (-0.22, TOP), "back": (0.25, TOP + STEP)}                 # a table's two rows: y, z
RISER = (0.25, 0.4)                                                        # the riser's middle (y) and depth
RING = (0.4, 0.74); CROWN = 1.0                                            # a round stand: ring radius and height, and the height of its top tier
TIERS = [(-0.26, 0.5), (0.0, 0.8), (0.26, 1.1)]                            # a rack's three steps: y, z
HEAD_Z = 1.05                                                              # where a hat's brim sits on the head form: a bust on a short post, not a head at full height
HEAD_SHOWROOM = 1.6                                                        # the same line on the showroom's head; an item's "lift" is measured against that one
HOOK = {"reach": 0.0, "post": 0.17, "height": 1.02}                        # SD_Hook: the hang point is this far above its base; the post stands behind it
BOARD = {"height": 0.36, "face": -0.035}                                   # SD_Board: the middle of its face above its base, and the face's y
TAG = 0.13                                                                 # width of a price tag
ACCESSORIES = ("SD_Hook", "SD_Board", "SD_Tag")
