"""species_defs.py — silhouette parameters for the Kindred cast.

All eight archetypes from src/avatar/species.js are here so nothing
downstream breaks, but the four leads (fox / bear / rabbit / otter) carry
the most pushed silhouettes. Every design is original to Kindred: the
shared style vocabulary is 'chunky 3-heads-tall mascot with an oversized
readable head, thick tapered limbs, mitt hands and flat saturated-but-warm
colour', not any specific existing character.

Colours follow the Design Bible palette rules: warm, never pure white or
pure black, saturation kept in the 'warm terracotta / sage / ochre /
lavender' family rather than neon.
"""

SPECIES = {
    "fox": dict(
        skin=0xE08A4A, light=0xFFF0DC, ink=0x4A2E1E, main=0xC96A4E, trim=0xF3D2A8,
        head=(0.308, 0.285, 0.296), headY=1.175,
        chest=1.00, waist=1.00, hip=1.00, legT=1.00, armT=1.00,
        ear="triangle", earSize=1.25, muzzle=(0.13, 0.085, 0.15), muzzleY=-0.055,
        tail="sweep", tailScale=1.35, belly=True,
    ),
    "bear": dict(
        skin=0x9E6238, light=0xF7E0BC, ink=0x3E2617, main=0x7E9A6B, trim=0xF0DCB4,
        head=(0.300, 0.330, 0.300), headY=1.185,
        chest=1.06, waist=1.06, hip=1.06, legT=1.06, armT=1.06,
        ear="round", earSize=0.88, muzzle=(0.14, 0.10, 0.14), muzzleY=-0.06,
        tail="stub", tailScale=0.8, belly=True,
    ),
    "rabbit": dict(
        skin=0xF3DFC8, light=0xFFFBF0, ink=0x5A4334, main=0xB4A8D8, trim=0xFFF0D8,
        head=(0.291, 0.291, 0.285), headY=1.175,
        chest=1.00, waist=1.00, hip=1.00, legT=1.00, armT=1.00,
        ear="long", earSize=1.0, muzzle=(0.11, 0.075, 0.11), muzzleY=-0.055,
        tail="poof", tailScale=1.0, belly=False,
    ),
    "otter": dict(
        skin=0x8A5C3A, light=0xF6DFB8, ink=0x3A2718, main=0x6FA8A2, trim=0xFBEBCF,
        head=(0.296, 0.268, 0.291), headY=1.175,
        chest=1.00, waist=1.00, hip=1.00, legT=1.00, armT=1.00,
        ear="tiny", earSize=0.8, muzzle=(0.135, 0.085, 0.13), muzzleY=-0.05,
        tail="paddle", tailScale=1.3, belly=True,
    ),
    "cat": dict(
        skin=0xD9A86A, light=0xFFF0D6, ink=0x43301F, main=0x8FA8C8, trim=0xFBE9CE,
        head=(0.262, 0.262, 0.258), headY=1.190,
        chest=1.00, waist=1.00, hip=1.00, legT=1.00, armT=1.00,
        ear="triangle", earSize=1.30, muzzle=(0.10, 0.065, 0.095), muzzleY=-0.045,
        tail="whip", tailScale=1.5, belly=False,
    ),
    "dog": dict(
        skin=0xE0A557, light=0xFFF2D8, ink=0x46301C, main=0xCF8A6A, trim=0xF6DCB6,
        head=(0.302, 0.285, 0.296), headY=1.175,
        chest=1.02, waist=1.00, hip=1.00, legT=1.00, armT=1.02,
        ear="floppy", earSize=1.45, muzzle=(0.150, 0.105, 0.235), muzzleY=-0.065,
        tail="curl", tailScale=1.0, belly=False,
    ),
    "panda": dict(
        skin=0xF6EEE0, light=0xFFFDF6, ink=0x3B322C, main=0x9DBE8E, trim=0xFFF2DC,
        head=(0.370, 0.272, 0.315), headY=1.150,
        chest=1.06, waist=1.06, hip=1.06, legT=1.06, armT=1.06,
        ear="round", earSize=1.55, muzzle=(0.13, 0.085, 0.12), muzzleY=-0.05,
        tail="stub", tailScale=0.8, belly=False, eyePatch=True, darkLimbs=0x4A3F38,
    ),
    "hedgehog": dict(
        skin=0xD9A85C, light=0xFFEFCE, ink=0x43301F, main=0xA98C6B, trim=0xF4E2C2,
        head=(0.285, 0.279, 0.285), headY=1.175,
        chest=1.04, waist=1.02, hip=1.04, legT=1.00, armT=1.00,
        ear="tiny", earSize=0.7, muzzle=(0.125, 0.08, 0.145), muzzleY=-0.055,
        tail="none", tailScale=1.0, belly=False, quills=True,
    ),
}

SPECIES_LIST = ["fox", "rabbit", "bear", "cat", "dog", "panda", "otter", "hedgehog"]
