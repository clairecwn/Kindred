"""preview_dressed.py — render a character wearing garments, to eyeball fit."""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import bpy
import build_characters as BC, build_wardrobe_glb as WG
from geom import join, tri_count
from species_defs import SPECIES

def main():
    sid = sys.argv[sys.argv.index('--sp')+1] if '--sp' in sys.argv else 'fox'
    gids = (sys.argv[sys.argv.index('--g')+1] if '--g' in sys.argv else 'body_hoodie,legs_trousers,head_beanie').split(',')
    BC.reset_scene()
    p = SPECIES[sid]
    m_skin=BC.mat("mat_skin",p["skin"]); m_light=BC.mat("mat_skin_light",p["light"])
    m_ink=BC.mat("mat_ink",p["ink"]); m_w=BC.mat("mat_eye_white",0xFFFBF2,True)
    m_p=BC.mat("mat_eye_pupil",0x241A12,True); m_s=BC.mat("mat_eye_shine",0xFFFFFF,True)
    m_main=BC.mat("mat_main",0x5E7FA8); m_trim=BC.mat("mat_trim",0xF7E6C4)
    arm = BC.build_armature()
    body = join(BC.build_body_parts(p), "Body"); BC.fuse(body, voxel=0.0090, target_tris=7000)
    BC.set_mat(body, m_skin)
    extras = BC.build_face(p,m_light,m_ink,m_w,m_p,m_s)+BC.build_ears(p,m_skin,m_light)+BC.build_tail(p,m_skin,m_light)
    if p.get("quills"): extras += BC.build_quills(p, m_ink)
    BC.auto_weight(body, arm)
    for (_n,o,b) in extras: BC.rigid_weight(o, arm, b)
    for gid in gids:
        builder, bone = WG.GARMENTS[gid]
        mains, trims = builder()
        mo = join(mains, "g_%s_m"%gid); BC.set_mat(mo, m_main)
        pieces=[mo]
        if trims:
            to = join(trims, "g_%s_t"%gid); BC.set_mat(to, m_trim); pieces.append(to)
        for pc in pieces:
            if bone: BC.rigid_weight(pc, arm, bone)
            else: BC.auto_weight(pc, arm)
    BC.render_turnaround("dressed_"+sid, angles=(0,45,90))
main()
