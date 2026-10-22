"""Author the new Kingdom island. Only writes assets/kingdom.

Run with Blender --background --factory-startup --python this_file.
The single source file is kingdom_island.blend. Re-running replaces only
this generated scene; use --render-only to render the saved authored file.
"""
import bpy
import math
import random
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
SOURCE = ROOT / 'blender' / 'kingdom_island.blend'
RENDERS = ROOT / 'renders'
for p in (RENDERS, ROOT / 'docs'):
    p.mkdir(parents=True, exist_ok=True)
random.seed(28)
Z = 2.0
PAL = {
    'cream':'FFF1D0','white':'FFFAEC','sand':'F2D08A','cliff':'C9783A',
    'cliff_light':'E09A52','red':'E52521','roof_light':'F05235','roof_dark':'BC322B',
    'green':'43B047','lawn':'5CC83C','leaf_dark':'2E9A45','leaf_light':'8FDC4E',
    'teal':'1CC7B5','water':'3ED6E0','water_deep':'19ACCE','foam':'C9F7ED',
    'blue':'049CD8','glass':'83D8ED','yellow':'FBD000','pink':'FF7EB6',
    'purple':'8B5FD9','wood':'C98443','trunk':'A8622B','dark':'493C51',
    'soil':'91522F','carrot':'FF8A2A','stone':'E9DCC3','hay':'E8B947',
}

def lin(h):
    c = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)

def collection(name):
    c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); return c

def move_collection(o,c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o); return o

def material(name,rough=.65):
    m=bpy.data.materials.new('KI_'+name); m.use_nodes=True
    m.diffuse_color=(*lin(PAL[name]),1)
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color
    bs.inputs['Roughness'].default_value=rough
    return m

def finish(o,name,mat,c,smooth=False):
    o.name=name; move_collection(o,c)
    if mat: o.data.materials.append(M[mat])
    if o.type=='MESH' and smooth:
        for f in o.data.polygons: f.use_smooth=True
    return o

def cube(name,loc,size,mat,c,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat,c)
    if bevel:
        b=o.modifiers.new('Soft crafted edges','BEVEL'); b.width=bevel; b.segments=3
        n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def uv(name,loc,scale,mat,c,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object; o.scale=scale; return finish(o,name,mat,c,True)

def cyl(name,loc,r,depth,mat,c,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=finish(bpy.context.object,name,mat,c,True)
    b=o.modifiers.new('Rounded rims','BEVEL'); b.width=min(.045,r*.15); b.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return o

def beam(name,a,b,r,mat,c):
    a,b=Vector(a),Vector(b); o=cyl(name,(a+b)/2,r,(b-a).length,mat,c,16)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o

def mesh(name,verts,faces,mat,c,smooth=False):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); c.objects.link(o)
    if mat: me.materials.append(M[mat])
    if smooth:
        for f in me.polygons: f.use_smooth=True
    return o

def curve(name,pts,r,mat,c,cyclic=False):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=16
    cu.bevel_depth=r; cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for b,p in zip(sp.bezier_points,pts): b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    sp.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,cu); c.objects.link(o); cu.materials.append(M[mat]); return o

def path(name,pts,width,mat='cream',z=Z+.035):
    # Catmull-Rom centreline expanded to a continuous, flat walking ribbon.
    ps=[Vector((x,y)) for x,y in pts]; ex=[ps[0]]+ps+[ps[-1]]; out=[]
    for i in range(1,len(ex)-2):
        a,b,c,d=ex[i-1:i+3]
        for k in range(12):
            t=k/12; out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    out.append(ps[-1]); verts=[]
    for i,p in enumerate(out):
        tangent=out[min(i+1,len(out)-1)]-out[max(0,i-1)]; tangent.normalize()
        side=Vector((-tangent.y,tangent.x))*width/2
        verts.extend([(p.x+side.x,p.y+side.y,z),(p.x-side.x,p.y-side.y,z)])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(out)-1)]
    o=mesh(name,verts,faces,mat,C['paths']); sol=o.modifiers.new('Path depth','SOLIDIFY'); sol.thickness=.06
    for sign in [-1,1]:
        edge=[]
        for i in range(0,len(out),4): edge.append(verts[2*i+(0 if sign==1 else 1)])
        curve(name+'_border_'+str(sign),edge,.075,'sand',C['paths'])
    return o

def island(name,center,rx,ry,z,base,c,small=False):
    n=128 if not small else 64
    rings=[(.83,base),(.94,base+.25),(1.015,z-.66),(1.018,z-.36),(.994,z-.10),(.975,z)]
    verts=[]
    for s,h in rings:
        for i in range(n):
            a=i*2*math.pi/n; wobble=1+.04*math.sin(3*a+.4)+.025*math.sin(5*a-1.2)
            verts.append((center[0]+rx*s*wobble*math.cos(a),center[1]+ry*s*wobble*math.sin(a),h))
    faces=[]
    for j in range(len(rings)-1):
        for i in range(n): faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.append(tuple(range(n-1,-1,-1))); faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    o=mesh(name,verts,faces,None,c)
    for m in ['cliff','cliff_light','sand','lawn']: o.data.materials.append(M[m])
    for j,p in enumerate(o.data.polygons):
        p.material_index=3 if j==(len(rings)-1)*n+1 or j//n>=4 else [0,1,2,3][min(j//n,3)]
        p.use_smooth=len(p.vertices)==4
    return o

def tree(name,x,y,s=1,fruit=False,c=None,z=Z):
    c=c or C['trees']; beam(name+'_trunk',(x,y,z),(x+.12*s,y,z+2.45*s),.19*s,'trunk',c)
    for i,a in enumerate([.3,2.4,4.5]):
        tip=(x+.68*s*math.cos(a),y+.68*s*math.sin(a),z+2.85*s)
        beam(name+'_branch_'+str(i),(x,y,z+1.7*s),tip,.105*s,'trunk',c)
    lobes=[(0,0,3.25,1.25),(-.75,0,2.9,.9),(.72,.15,3,.94),(0,.7,3.15,.95),(0,-.55,3.65,.9)]
    for i,(dx,dy,dz,r) in enumerate(lobes):
        uv(name+'_crown_'+str(i),(x+dx*s,y+dy*s,z+dz*s),(r*s,r*.88*s,r*1.03*s),'leaf_light' if i==4 else 'green' if i%2 else 'leaf_dark',c)
    if fruit:
        for i,a in enumerate([.1,1.3,2.6,3.8,5]):
            uv(name+'_citrus_'+str(i),(x+1.1*s*math.cos(a),y+1.0*s*math.sin(a),z+(2.8+.35*(i%2))*s),(.16*s,)*3,'carrot',c,16,10)

def flower(name,x,y,z,colour='pink',s=1):
    beam(name+'_stem',(x,y,z),(x,y,z+.34*s),.022*s,'leaf_dark',C['garden'])
    uv(name+'_leaf',(x+.09*s,y,z+.16*s),(.15*s,.06*s,.045*s),'green',C['garden'],12,8)
    for i in range(5):
        a=i*math.tau/5; uv(name+'_petal'+str(i),(x+.11*s*math.cos(a),y+.11*s*math.sin(a),z+.36*s),(.10*s,.10*s,.055*s),colour,C['garden'],12,8)
    uv(name+'_heart',(x,y,z+.39*s),(.065*s,.065*s,.045*s),'yellow',C['garden'],12,8)

def roof(name,x,y,z,w,d,h,mat,c):
    verts=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x,y-d/2,z+h),(x-w/2,y+d/2,z),(x+w/2,y+d/2,z),(x,y+d/2,z+h)]
    o=mesh(name,verts,[(0,2,5,3),(2,1,4,5)],mat,c)
    solid=o.modifiers.new('Roof thickness','SOLIDIFY'); solid.thickness=.16
    b=o.modifiers.new('Soft roof edges','BEVEL'); b.width=.10; b.segments=3; o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    for side in [-1,1]:
        for row in range(5):
            f=(row+.5)/5; xx=x+side*(w/2*f); zz=z+h*(1-f)+.065
            for k in range(11):
                yy=y-d/2+(k+.5)*d/11
                tile=cube(name+'_tile_'+str(side)+'_'+str(row)+'_'+str(k),(xx,yy,zz),(w/10+.065,d/11-.025,.12),'roof_light' if (row+k)%5==0 else mat,c,.06)
                tile.rotation_euler.y=side*math.atan2(h,w/2)
    beam(name+'_ridge',(x,y-d/2-.05,z+h+.09),(x,y+d/2+.05,z+h+.09),.14,mat,c)
    for yy in [y-d/2-.05,y+d/2+.05]:
        beam(name+'_fascia_l',(x-w/2,yy,z),(x,yy,z+h),.115,'white',c)
        beam(name+'_fascia_r',(x,yy,z+h),(x+w/2,yy,z),.115,'white',c)
    return o

def boolean_box(wall,name,loc,size):
    cutter=cube(name+'_cutter',loc,size,None,C['house'],0)
    mod=wall.modifiers.new(name,'BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT'; mod.object=cutter
    bpy.context.view_layer.objects.active=wall; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    wall['opening_'+name]=True

def fence(name,pts,c=None):
    c=c or C['stable']
    for i,(x,y) in enumerate(pts):
        cube(name+'_post'+str(i),(x,y,Z+.57),(.16,.16,1.14),'white',c,.04)
        uv(name+'_cap'+str(i),(x,y,Z+1.16),(.13,.13,.12),'cream',c,12,8)
    for a,b in zip(pts,pts[1:]):
        for h in [.42,.87]: beam(name+'_rail',(a[0],a[1],Z+h),(b[0],b[1],Z+h),.06,'white',c)

def camera(name,loc,target,lens=42,ortho=None):
    d=bpy.data.cameras.new(name); o=bpy.data.objects.new(name,d); C['lighting'].objects.link(o)
    o.location=loc; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    d.lens=lens; d.clip_end=500
    if ortho: d.type='ORTHO'; d.ortho_scale=ortho
    return o

def build():
    global M,C
    bpy.ops.wm.read_factory_settings(use_empty=True)
    C={k:collection('KINGDOM_'+k.upper()) for k in ['terrain','paths','house','garden','farm','stable','trees','dock','decor','backdrop','lighting','character_reference']}
    M={k:material(k,.28 if k in ['water','water_deep','glass'] else .58 if 'leaf' in k else .72) for k in PAL}
    scene=bpy.context.scene; scene.unit_settings.system='METRIC'
    island('Home_Island',(0,0),21,18,Z,-1.4,C['terrain'])
    # A continuous sea and smaller landforms establish distance without blocking routes.
    cube('Sea',(0,0,-.35),(450,450,.4),'water_deep',C['backdrop'],0)
    for i,(x,y,rx,ry,h) in enumerate([(-52,35,10,8,2.4),(48,40,13,9,3),(4,68,11,8,2),(-58,-23,8,7,1.4),(63,-18,10,8,2.0)]):
        island('Distant_Island_'+str(i),(x,y),rx,ry,h,-1.5,C['backdrop'],True)
        for k in range(3): tree('Distant_Tree_'+str(i)+'_'+str(k),x+(k-1)*3,y+(k%2)*2,1.2,False,C['backdrop'],h)
        uv('Distant_Hill_'+str(i),(x,y+2,h),(rx*.6,ry*.6,4.5),'green',C['backdrop'])
    for j in range(3):
        pts=[]
        for i in range(90):
            a=i*math.tau/90; r=1+.04*math.sin(3*a+.4)+.025*math.sin(5*a-1.2)
            pts.append(((21.5+j*.6)*r*math.cos(a),(18.5+j*.6)*r*math.sin(a),-.10+j*.008))
        curve('Shore_foam_'+str(j),pts,.055 if j==0 else .035,'foam',C['backdrop'],True)
    for i in range(90):
        x=random.uniform(-65,65); y=random.uniform(-48,60)
        if (x/24)**2+(y/21)**2<1: continue
        curve('Sea_glint_'+str(i),[(x-.5,y,-.12),(x,y+.06,-.10),(x+.5,y,-.12)],.025,'foam',C['backdrop'])
    for i,(x,y) in enumerate([(-16,9),(-18,1),(-16,-10),(17,9),(16,-11),(-9,14),(9,14)]):
        uv('Shore_rock_'+str(i),(x,y,1.6),(1.1,.85,.75),'stone',C['terrain'])

    path('Arrival_to_house',[(0,-18),(0,-13),(-1,-8),(-2,-2),(-3,1.05)],2.6)
    path('Garden_walk',[(-1,-9),(-6,-9),(-10,-7),(-11,-3)],1.8)
    path('Farm_walk',[(-2,-3),(3,-2),(7,0),(9,4)],2.0)
    path('Stable_walk',[(4,-2),(7,-5),(10,-7)],1.8)
    path('Orchard_walk',[(7,1),(7,7),(4,11),(-1,11)],1.5)

    # House: true shell, real Boolean openings, empty placeable interior.
    hx,hy=-3,5.0; floor=Z+.24
    cube('House_foundation',(hx,hy,Z+.10),(8.8,7.4,.2),'stone',C['house'],.13)
    cube('House_floor',(hx,hy,floor-.05),(8.4,7.0,.1),'wood',C['house'],.025)
    for i in range(21): cube('Floor_board_'+str(i),(hx-4+i*.4,hy,floor+.008),(.385,6.65,.025),'wood',C['house'],.007)
    front=cube('House_front_wall',(hx,hy-3.5,floor+1.75),(8.5,.3,3.5),'cream',C['house'],0)
    boolean_box(front,'main_door',(hx,hy-3.5,floor+1.4),(2.4,.8,2.8))
    for dx in [-2.7,2.7]: boolean_box(front,'front_window_'+str(dx),(hx+dx,hy-3.5,floor+1.8),(1.5,.8,1.6))
    back=cube('House_back_wall',(hx,hy+3.5,floor+1.75),(8.5,.3,3.5),'cream',C['house'],.06)
    for sx in [-1,1]:
        wall=cube('House_side_'+str(sx),(hx+sx*4.1,hy,floor+1.75),(.3,7.0,3.5),'cream',C['house'],0)
        boolean_box(wall,'side_window',(hx+sx*4.1,hy,floor+1.8),(.8,1.8,1.6))
        cube('Side_glass_'+str(sx),(hx+sx*4.12,hy,floor+1.8),(.04,1.65,1.46),'glass',C['house'],.03)
        for dy in [-.95,.95]: cube('Side_frame',(hx+sx*4.23,hy+dy,floor+1.8),(.2,.13,1.82),'white',C['house'],.03)
        for dz in [1.0,2.6]: cube('Side_sill',(hx+sx*4.25,hy,floor+dz),(.38,2.0,.14),'white',C['house'],.03)
    for dx in [-2.7,2.7]:
        x=hx+dx; y=hy-3.68
        cube('Front_glass',(x,y+.05,floor+1.8),(1.42,.035,1.5),'glass',C['house'],.04)
        for sx in [-1,1]:
            cube('Window_jamb',(x+sx*.80,y,floor+1.8),(.14,.22,1.82),'white',C['house'],.035)
            cube('Blue_shutter',(x+sx*1.03,y+.03,floor+1.8),(.33,.13,1.6),'blue',C['house'],.04)
            for n in range(6): cube('Shutter_slat',(x+sx*1.03,y-.045,floor+1.15+n*.24),(.32,.08,.07),'glass',C['house'],.02)
        for zz in [floor+1.0,floor+2.6]: cube('Window_frame',(x,y,zz),(1.75,.25,.15),'white',C['house'],.03)
        cube('Window_cross_vertical',(x,y-.04,floor+1.8),(.07,.12,1.52),'white',C['house'],.02)
        cube('Window_cross_horizontal',(x,y-.04,floor+1.8),(1.5,.12,.07),'white',C['house'],.02)
        cube('Window_box',(x,y-.27,floor+.91),(1.75,.48,.34),'wood',C['house'],.07)
        for k in range(6): flower('Window_flower',x-.65+k*.25,y-.28,floor+1.05,'pink' if k%2 else 'yellow',.7)
    for sx in [-1,1]: cube('Door_jamb',(hx+sx*1.26,hy-3.67,floor+1.43),(.13,.28,2.86),'white',C['house'],.04)
    cube('Door_header',(hx,hy-3.67,floor+2.87),(2.65,.30,.16),'white',C['house'],.045)
    # Door leaf sits open inside the room, leaving a 2.4m passage.
    leaf=cube('Open_blue_door',(hx-1.11,hy-2.9,floor+1.36),(.15,1.42,2.72),'blue',C['house'],.045)
    uv('Door_knob',(hx-1.01,hy-2.35,floor+1.25),(.08,)*3,'yellow',C['house'],12,8)
    cube('Porch',(hx,hy-4.18,Z+.12),(5.8,1.45,.24),'stone',C['house'],.06)
    cube('Porch_step',(hx,hy-5.02,Z+.06),(3.5,.42,.12),'stone',C['house'],.04)
    roof('Cottage_roof',hx,hy,floor+3.48,9.6,8.0,2.45,'red',C['house'])
    # Gable end is a complete closed triangle, with an ornamental round vent.
    mesh('Front_gable',[(hx-4.1,hy-3.51,floor+3.47),(hx+4.1,hy-3.51,floor+3.47),(hx,hy-3.51,floor+5.58)],[(0,1,2)],'cream',C['house'])
    vent=cyl('Attic_vent',(hx,hy-3.58,floor+4.25),.43,.15,'white',C['house']); vent.rotation_euler.x=math.pi/2
    inner=cyl('Attic_vent_inset',(hx,hy-3.68,floor+4.25),.32,.05,'blue',C['house']); inner.rotation_euler.x=math.pi/2
    for dx in [-.15,0,.15]: cube('Vent_louver',(hx+dx,hy-3.73,floor+4.25),(.045,.05,.52),'white',C['house'],.01)
    roof('Porch_canopy',hx,hy-4.1,floor+2.91,3.4,2.0,.72,'red',C['house'])
    for sx in [-1,1]: cube('Porch_post',(hx+sx*1.55,hy-4.8,Z+1.65),(.16,.16,3.06),'white',C['house'],.04)
    cube('Chimney',(hx+2.5,hy+1,floor+5.2),(.85,.85,2.2),'cream',C['house'],.09)
    cube('Chimney_cap',(hx+2.5,hy+1,floor+6.32),(1.1,1.1,.24),'roof_dark',C['house'],.07)
    for zz in [floor+4.65,floor+5.15,floor+5.65]: cube('Chimney_band',(hx+2.5,hy+1,zz),(.9,.9,.08),'sand',C['house'],.025)
    for x in [hx-4,hx+4]: cube('House_corner_trim',(x,hy-3.66,floor+1.75),(.2,.12,3.5),'white',C['house'],.025)

    # Garden beds and pond; ornament stays outside the main travel lane.
    for i,(x,y) in enumerate([(-12,-7),(-14,-3),(-9,-2)]):
        cube('Garden_bed_'+str(i),(x,y,Z+.13),(2.7,1.5,.26),'wood',C['garden'],.18)
        cube('Garden_soil_'+str(i),(x,y,Z+.265),(2.38,1.18,.04),'soil',C['garden'],.13)
        for k in range(10): flower('Garden_'+str(i)+'_'+str(k),x-.95+(k%5)*.47,y-.32+(k//5)*.63,Z+.29,['pink','yellow','purple'][i],1)
    uv('Pond_bank',(-11,-11,Z-.03),(3.1,2,.25),'sand',C['garden'],40,16)
    uv('Pond_water',(-11,-11,Z+.05),(2.7,1.62,.1),'water',C['garden'],40,16)
    for i in range(5):
        a=i*math.tau/5; uv('Pond_stone_'+str(i),(-11+2.85*math.cos(a),-11+1.7*math.sin(a),Z+.13),(.45,.32,.23),'stone',C['garden'])
    for x,y in [(-11.6,-11),(-10.5,-11.4)]: cyl('Lily_pad',(x,y,Z+.17),.35,.025,'green',C['garden'])
    # Two independently modelled pieces demonstrate furniture scale.
    for bx,by in [(-9,-5.1)]:
        for dx in [-.8,.8]:
            for dy in [-.23,.23]: cube('Garden_bench_leg',(bx+dx,by+dy,Z+.24),(.12,.12,.48),'white',C['decor'],.025)
        for k in range(3): cube('Garden_bench_seat',(bx,by-.24+k*.24,Z+.49),(2.1,.2,.12),'wood',C['decor'],.04)
        for dx in [-.9,.9]: cube('Bench_back_post',(bx+dx,by+.30,Z+.8),(.12,.12,.7),'white',C['decor'],.025)
        for zz in [.78,1.03]: cube('Bench_back_slat',(bx,by+.30,Z+zz),(2.1,.12,.18),'wood',C['decor'],.04)

    # Farm: 1.3m aisles between timber-edged planting beds.
    for row in range(3):
        for col in range(2):
            x=10+col*3.5; y=2+row*3.0; tag=f'Plot_{row}_{col}'
            cube(tag+'_border',(x,y,Z+.13),(2.3,1.7,.26),'wood',C['farm'],.09)
            cube(tag+'_soil',(x,y,Z+.265),(2.08,1.48,.035),'soil',C['farm'],.06)
            for n in range(6):
                xx=x-.68+(n%3)*.68; yy=y-.38+(n//3)*.76
                if row==0:
                    uv(tag+'_carrot',(xx,yy,Z+.36),(.12,.12,.19),'carrot',C['farm'],12,8)
                    for k in range(3):
                        l=uv(tag+'_carrot_leaf',(xx+.09*math.cos(k*2.1),yy+.09*math.sin(k*2.1),Z+.66),(.06,.10,.24),'green',C['farm'],12,8); l.rotation_euler.y=.3
                elif row==1:
                    for k in range(5):
                        a=k*math.tau/5; uv(tag+'_cabbage',(xx+.12*math.cos(a),yy+.12*math.sin(a),Z+.46),(.20,.20,.20),'leaf_light' if k%2 else 'green',C['farm'],12,8)
                else:
                    for k in range(7):
                        a=k*math.tau/7; uv(tag+'_pumpkin',(xx+.10*math.cos(a),yy+.10*math.sin(a),Z+.48),(.22,.22,.23),'carrot',C['farm'],12,8)
                    beam(tag+'_stem',(xx,yy,Z+.68),(xx+.03,yy,Z+.81),.04,'trunk',C['farm'])
    cube('Tool_shed_body',(14,11,Z+1.0),(3.0,2.0,2.0),'teal',C['farm'],.08)
    roof('Tool_shed_roof',14,11,Z+2.0,3.5,2.5,.9,'red',C['farm'])
    cube('Tool_shed_door',(14,9.95,Z+.9),(1.1,.08,1.8),'wood',C['farm'],.04)
    for dx in [-.62,.62]: cube('Shed_jamb',(14+dx,9.85,Z+.95),(.12,.18,1.9),'white',C['farm'],.02)
    cube('Shed_door_lintel',(14,9.85,Z+1.92),(1.36,.18,.13),'white',C['farm'],.02)
    beam('Garden_rake_handle',(15.7,9.6,Z),(15.6,9.4,Z+1.4),.04,'wood',C['farm'])
    cube('Garden_rake_head',(15.7,9.6,Z+.1),(.55,.13,.18),'blue',C['farm'],.03)
    for i in range(5): cube('Rake_tine',(15.5+i*.1,9.54,Z+.04),(.03,.06,.16),'blue',C['farm'],.01)
    for i,(x,y) in enumerate([(5,11),(8,13),(2,13)]): tree('Orchard_'+str(i),x,y,.9,True)

    # Open stable with a visibly usable bay, hay rack and water trough.
    sx,sy=12,-6
    cube('Stable_floor',(sx,sy,Z+.05),(5.2,4.2,.1),'sand',C['stable'],.07)
    cube('Stable_back',(sx,sy+2,Z+1.25),(5.2,.2,2.5),'wood',C['stable'],.05)
    for side in [-1,1]:
        cube('Stable_side',(sx+side*2.5,sy,Z+.85),(.2,4,1.7),'wood',C['stable'],.05)
        for yy in [sy-2,sy+2]: cube('Stable_post',(sx+side*2.5,yy,Z+1.6),(.22,.22,3.2),'white',C['stable'],.04)
    roof('Stable_roof',sx,sy,Z+3.15,5.9,4.9,1.2,'blue',C['stable'])
    cube('Stable_front_header',(sx,sy-2,Z+2.98),(5.3,.25,.32),'white',C['stable'],.05)
    for i in range(3):
        bale=cyl('Hay_bale_'+str(i),(sx-1.5+i*.55,sy+.7,Z+.36),.34,.55,'hay',C['stable']); bale.rotation_euler.y=math.pi/2
    cube('Trough_base',(sx+1.65,sy+.4,Z+.28),(.6,1.5,.56),'stone',C['stable'],.12)
    cube('Trough_water',(sx+1.65,sy+.4,Z+.565),(.43,1.3,.025),'water',C['stable'],.10)
    fence('Paddock_left',[(9.3,-8),(9.3,-10),(9.3,-12)])
    fence('Paddock_front',[(9.3,-12),(11,-12),(12.7,-12),(14.5,-12)])
    fence('Paddock_right',[(14.5,-12),(16,-10.5),(16,-8.5),(14.7,-8)])
    # No horse is invented as an owned animal; the paddock is a usable base.

    for i,(x,y,s) in enumerate([(-14,7,1.1),(-12,12,1.15),(-7,14,1.0),(-17,-4,.95),(18,0,.8),(-5,-13,.85)]): tree('Island_tree_'+str(i),x,y,s)
    for i in range(45):
        a=random.uniform(0,math.tau); x=18.3*math.cos(a); y=15.6*math.sin(a)
        if abs(x)<3 and y<0: continue
        for k in range(3):
            leaf=uv('Shore_grass',(x+(k-1)*.12,y,Z+.16),(.075,.13,.25),'green',C['trees'],10,6); leaf.rotation_euler.y=(k-1)*.3

    # Dock meets the arrival path at exactly the same deck height.
    for i in range(19): cube('Dock_plank_'+str(i),(0,-18.0-i*.30,Z-.06),(2.7,.275,.12),'wood',C['dock'],.025)
    for x in [-1.5,1.5]:
        for y in [-18,-20,-22.9]: cyl('Dock_pile',(x,y,.7),.15,3.4,'trunk',C['dock'],16)
        curve('Dock_rope',[(x,-18,Z+.6),(x,-19,Z+.38),(x,-20,Z+.6),(x,-21.4,Z+.35),(x,-22.9,Z+.6)],.038,'cream',C['dock'])
    cube('Arrival_mailbox_post',(-2,-16,Z+.65),(.16,.16,1.3),'wood',C['decor'],.04)
    cube('Arrival_mailbox',(-2,-16,Z+1.45),(.65,.75,.45),'blue',C['decor'],.19)
    cube('Mailbox_slot',(-2,-16.385,Z+1.48),(.38,.03,.06),'dark',C['decor'],.02)

    # Import the current project character as a reference at original scale.
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(REPO/'frontend/public/models/kindred_char01.glb'))
    imported=[o for o in bpy.data.objects if o not in before]
    for o in imported: move_collection(o,C['character_reference'])
    arm=next((o for o in imported if o.type=='ARMATURE'),None)
    if arm:
        for tr in list(arm.animation_data.nla_tracks) if arm.animation_data else []: tr.mute=True
        action=next((a for a in bpy.data.actions if a.name.lower()=='idle'),None)
        if action:
            arm.animation_data_create(); arm.animation_data.action=action
            if hasattr(action,'slots') and action.slots: arm.animation_data.action_slot=action.slots[0]
    character_meshes={'Kindred_Body','Hair_Full','FaceInk','FaceWhite','FaceBlush','Tongue'}
    for o in imported:
        if o.type=='MESH' and o.name not in character_meshes:
            o.hide_render=True; o.hide_set(True)
    scene.frame_set(1); bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get(); points=[]
    for o in imported:
        if o.type!='MESH' or o.hide_render: continue
        ev=o.evaluated_get(dg); points.extend(ev.matrix_world@v.co for v in ev.data.vertices)
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3))); hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    for o in imported:
        if o.parent not in imported: o.location+=Vector((-1,-3,Z-lo.z))
    C['character_reference']['source']='frontend/public/models/kindred_char01.glb'
    C['character_reference']['exclude_from_environment_export']=True

    # Soft daylight with a bright cyan horizon and saturated but shaded materials.
    world=bpy.data.worlds.new('Kingdom_daylight'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(*lin('BEE9F7'),1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
    ld=bpy.data.lights.new('Island_sun','SUN'); ld.energy=2.4; ld.angle=math.radians(12)
    ob=bpy.data.objects.new('Island_sun',ld); C['lighting'].objects.link(ob); ob.rotation_euler=(math.radians(25),math.radians(-24),math.radians(-30))
    ld=bpy.data.lights.new('Sky_softbox','AREA'); ld.energy=1700; ld.shape='DISK'; ld.size=18
    ob=bpy.data.objects.new('Sky_softbox',ld); C['lighting'].objects.link(ob); ob.location=(-10,-10,24)
    for i,(x,y,z,s) in enumerate([(-38,45,18,4),(15,60,23,5),(50,45,20,4)]):
        for k in range(4): uv('Cloud_'+str(i)+'_'+str(k),(x+(k-1.5)*s*.7,y,z+(1 if k in [1,2] else 0)*s*.3),(s,s*.5,s*.45),'white',C['backdrop'])
    camera('Kingdom_Overview',(38,-53,40),(0,0,2.0),42)
    camera('Kingdom_Arrival',(15,-28,17),(-2,3,3.0),40)
    camera('Kingdom_Home',(-14,-17,11),(-3,3,4),42)
    camera('Kingdom_Plan',(0,0,70),(0,0,0),ortho=52)
    camera('Kingdom_Farm',(25,-2,14),(10,5,3),42)
    scene.camera=bpy.data.objects['Kingdom_Overview']
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
    scene.render.resolution_x=1440; scene.render.resolution_y=1080; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='Standard'; scene.view_settings.look='None'; scene.view_settings.exposure=-.45
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    for area in bpy.context.screen.areas if bpy.context.screen else []:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.clip_end=500
    scene['kingdom_stage']='authored_form_review'
    scene['kingdom_design']='New island home; no legacy Kingdom geometry or UI'
    bpy.context.view_layer.update()
    tri=0
    for o in scene.objects:
        if o.type=='MESH' and o.name not in {x.name for x in imported}:
            ev=o.evaluated_get(dg); me=ev.to_mesh(); me.calc_loop_triangles(); tri+=len(me.loop_triangles); ev.to_mesh_clear()
    audit={'scene':'kingdom_island.blend','environment_triangles':tri,'character_source':'frontend/public/models/kindred_char01.glb','character_dimensions_m':[round(v,3) for v in hi-lo], 'house_door_clearance_m':[2.4,2.8], 'main_path_width_m':2.6,'farm_aisle_minimum_m':1.2,'reference_scale':1,'runtime_integrated':False,'grove_modified':False,'collections':{k:len(v.objects) for k,v in C.items()}}
    (ROOT/'docs/scene-audit.json').write_text(json.dumps(audit,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    print('KINGDOM_AUDIT',json.dumps(audit))

def render():
    scene=bpy.context.scene
    for name,out in [('Kingdom_Overview','kingdom_overview.png'),('Kingdom_Arrival','kingdom_arrival.png'),('Kingdom_Home','kingdom_home.png'),('Kingdom_Farm','kingdom_farm.png'),('Kingdom_Plan','kingdom_plan.png')]:
        if '--overview-only' in sys.argv and name!='Kingdom_Overview': continue
        scene.camera=bpy.data.objects[name]
        if name=='Kingdom_Plan':
            scene.render.resolution_x=1200; scene.render.resolution_y=1200
        else: scene.render.resolution_x=1440; scene.render.resolution_y=1080
        scene.render.filepath=str(RENDERS/out); bpy.ops.render.render(write_still=True)
    scene.camera=bpy.data.objects['Kingdom_Overview']

if '--render-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE)); render()
else:
    build()
    import runpy
    runpy.run_path(str(ROOT/'blender/refine_kingdom_review.py'))
    runpy.run_path(str(ROOT/'blender/finish_kingdom_surfaces.py'))
    runpy.run_path(str(ROOT/'blender/prepare_kingdom_handoff.py'))
    runpy.run_path(str(ROOT/'blender/expand_kingdom_home.py'))
    runpy.run_path(str(ROOT/'blender/finish_home_interior.py'))
    if '--no-render' not in sys.argv: render()
