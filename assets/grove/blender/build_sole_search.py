import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
BLOCKOUT=ROOT/"blender"/"grove_blockout.blend"
OUT=ROOT/"blender"/"sole_search_detail.blend"
WIDE=ROOT/"renders"/"sole_search_detail.png"
PROPS=ROOT/"renders"/"sole_search_props.png"

def C(n):
    c=bpy.data.collections.get(n)
    if not c: c=bpy.data.collections.new(n); bpy.context.scene.collection.children.link(c)
    return c

def M(n,c,r=.7,metal=0):
    m=bpy.data.materials.get(n) or bpy.data.materials.new(n); m.use_nodes=True; m.diffuse_color=(*c,1)
    b=m.node_tree.nodes.get("Principled BSDF"); b.inputs["Base Color"].default_value=(*c,1); b.inputs["Roughness"].default_value=r; b.inputs["Metallic"].default_value=metal
    return m

def move(o,c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)

def cube(n,p,d,m,c,b=.03):
    bpy.ops.mesh.primitive_cube_add(location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.scale=(d[0]/2,d[1]/2,d[2]/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if b: q=o.modifiers.new("soft_edges","BEVEL"); q.width=b; q.segments=3
    o.data.materials.append(m); move(o,c); return o

def cyl(n,p,r,d,m,c,v=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def torus(n,p,major,minor,m,c,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=p,rotation=rot); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def text(n,s,p,size,m,c):
    bpy.ops.object.text_add(location=p,rotation=(math.radians(90),0,math.radians(180))); o=bpy.context.view_layer.objects.active; o.name=n; o.data.body=s; o.data.align_x="CENTER"; o.data.size=size; o.data.extrude=.01; o.data.materials.append(m); move(o,c)

def aim(o,t): o.rotation_euler=(Vector(t)-o.location).to_track_quat("-Z","Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT)); scene=bpy.context.scene
shop,props,labels=C("SOLE_SEARCH_DETAIL"),C("SOLE_SEARCH_INDIVIDUAL_PROPS"),C("SOLE_SEARCH_LABELS")
floor=M("Sole_Floor",(.34,.38,.50),.8); wall=M("Sole_Wall",(.91,.79,.61),.78); wood=M("Sole_Wood",(.35,.18,.10),.72); cream=M("Sole_Cream",(.96,.86,.69),.7); lavender=M("Sole_Lavender",(.55,.39,.76),.62); coral=M("Sole_Coral",(.94,.40,.34),.62); blue=M("Sole_Blue",(.25,.45,.74),.62); mint=M("Sole_Mint",(.43,.68,.56),.68); gold=M("Sole_Gold",(.82,.50,.14),.34,.5); dark=M("Sole_Dark",(.06,.08,.11),.5)
cube("Sole_Floor_Inset",(-20,-14,5.04),(11,5.6,.08),floor,shop,.02)
cube("Sole_Back_Wall",(-20,-17.25,7.5),(12,.35,5),wall,shop,.08); cube("Sole_Left_Wall",(-25.8,-14,7.5),(.35,6.5,5),wall,shop,.08); cube("Sole_Right_Wall",(-14.2,-14,7.5),(.35,6.5,5),wall,shop,.08)
cube("Sole_Sign",(-20,-10.78,9.55),(7.5,.18,.9),lavender,shop,.12); text("Sole_Sign_Text","SOLE SEARCH",(-20,-10.65,9.65),.34,cream,labels)
for x in (-23.8,-20,-16.2):
    cube(f"Sole_Wall_Display_{x}",(x,-16.95,7.25),(2.4,.45,3.5),wood,shop,.06)
    for z in (6.2,7.2,8.2): cube(f"Sole_Shelf_{x}_{z}",(x,-16.62,z),(2.1,.55,.10),gold,shop,.02)
for i,x in enumerate((-23.5,-20,-16.5)):
    cyl(f"Sole_Pedestal_{i+1}",(x,-12.1,5.7),.72,1.25,mint if i==0 else coral if i==1 else blue,shop)
cube("Sole_Fitting_Bench",(-20,-14.2,5.55),(3.2,1.0,.7),cream,shop,.10); cube("Sole_Bench_Cushion",(-20,-14.2,5.95),(3.0,.85,.18),lavender,shop,.08)
for i,(x,m) in enumerate(((-23.5,coral),(-20,blue),(-16.5,lavender))):
    cube(f"Sneaker_{i+1}_Sole",(x,-12.1,6.38),(.95,.48,.15),cream,props,.08); cube(f"Sneaker_{i+1}_Upper",(x,-12.04,6.54),(.75,.42,.28),m,props,.10); cube(f"Sneaker_{i+1}_Toe",(x+.30,-12.04,6.51),(.30,.42,.18),mint,props,.09)
    for j in range(3): cube(f"Sneaker_{i+1}_Lace_{j+1}",(x-.10+j*.10,-12.27,6.62),(.24,.025,.025),cream,props,.008)
for i,x in enumerate((-24.2,-23.4,-20.4,-19.6)):
    cube(f"Shoe_Box_{i+1}",(x,-16.55,6.05),(.65,.48,.28),coral if i%2==0 else blue,props,.05); cube(f"Shoe_Box_Lid_{i+1}",(x,-16.55,6.22),(.7,.52,.06),cream,props,.02)
for i,x in enumerate((-17.0,-16.4)):
    cube(f"Ankle_Boot_{i+1}_Foot",(x,-16.55,7.15),(.62,.38,.22),wood,props,.08); cube(f"Ankle_Boot_{i+1}_Shaft",(x-.12,-16.55,7.46),(.34,.36,.55),wood,props,.07)
for i,x in enumerate((-20.3,-19.7)):
    cube(f"Sandal_{i+1}_Sole",(x,-16.55,8.15),(.62,.34,.08),cream,props,.05); torus(f"Sandal_{i+1}_Strap",(x,-16.55,8.28),.18,.04,gold,props,rot=(math.radians(90),0,0))
for i,x in enumerate((-21.2,-20.6,-20,-19.4,-18.8)): torus(f"Sock_Roll_{i+1}",(x,-14.2,6.15),.11,.055,coral if i%2==0 else mint,props,rot=(math.radians(90),0,0))
bpy.ops.object.camera_add(location=(-20,-6.8,8.4)); cam=bpy.context.view_layer.objects.active; cam.name="Sole_Search_Detail_Camera"; aim(cam,(-20,-14,6.8)); cam.data.lens=40; scene.camera=cam
bpy.ops.object.light_add(type="AREA",location=(-20,-11,13)); l=bpy.context.view_layer.objects.active; l.name="Sole_Softbox"; l.data.energy=1500; l.data.size=8; aim(l,(-20,-14,6))
bpy.ops.object.light_add(type="AREA",location=(-15,-8,9)); f=bpy.context.view_layer.objects.active; f.name="Sole_Fill"; f.data.energy=900; f.data.size=5; aim(f,(-20,-14,6.5))
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1200,850,80; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=1.2; scene.render.filepath=str(WIDE); bpy.ops.render.render(write_still=True)
bpy.ops.object.camera_add(location=(-14.5,-8.5,7.9)); pc=bpy.context.view_layer.objects.active; pc.name="Sole_Search_Props_Camera"; aim(pc,(-20,-12.5,6.4)); pc.data.lens=48; scene.camera=pc; scene.render.filepath=str(PROPS); bpy.ops.render.render(write_still=True); scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=str(OUT)); print(f"Saved Sole Search scene to {OUT}")
