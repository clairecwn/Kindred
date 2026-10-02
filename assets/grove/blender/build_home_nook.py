import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BLOCKOUT = ROOT / "blender" / "grove_blockout.blend"
OUT = ROOT / "blender" / "home_nook_detail.blend"
WIDE = ROOT / "renders" / "home_nook_detail.png"
PROPS = ROOT / "renders" / "home_nook_props.png"

def C(n):
    c=bpy.data.collections.get(n)
    if not c:
        c=bpy.data.collections.new(n); bpy.context.scene.collection.children.link(c)
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

def sph(n,p,s,m,c):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); move(o,c); return o

def cyl(n,p,r,d,m,c,v=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def cone(n,p,r1,r2,d,m,c):
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=r1,radius2=r2,depth=d,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def torus(n,p,major,minor,m,c):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def text(n,s,p,size,m,c):
    bpy.ops.object.text_add(location=p,rotation=(math.radians(90),0,math.radians(180))); o=bpy.context.view_layer.objects.active; o.name=n; o.data.body=s; o.data.align_x="CENTER"; o.data.size=size; o.data.extrude=.008; o.data.materials.append(m); move(o,c)

def aim(o,t): o.rotation_euler=(Vector(t)-o.location).to_track_quat("-Z","Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT)); scene=bpy.context.scene
shop,props,labels=C("HOME_NOOK_DETAIL"),C("HOME_NOOK_INDIVIDUAL_PROPS"),C("HOME_NOOK_LABELS")
floor=M("Home_Floor",(.55,.46,.35),.82); wood=M("Home_Wood",(.43,.22,.11),.76); brass=M("Home_Brass",(.82,.51,.16),.34,.5); sage=M("Home_Sage",(.40,.62,.46),.68); coral=M("Home_Coral",(.93,.39,.29),.62); cream=M("Home_Cream",(.95,.82,.58),.72); teal=M("Home_Teal",(.12,.48,.50),.6); pink=M("Home_Pink",(.94,.48,.58),.65); dark=M("Home_Dark",(.08,.1,.11),.5)
cube("Home_Floor_Inset",(20,14,.04),(11,5.6,.08),floor,shop,.02)
for x in (17,20,23):
    cube(f"Home_Shelf_{x}",(x,15.7,1.65),(2,.35,3),wood,shop,.06)
    for z in (1,1.8,2.6): cube(f"Home_Shelf_Board_{x}_{z}",(x,15.45,z),(1.8,.35,.08),brass,shop,.02)
cube("Home_Display_Table",(23.4,11.5,.65),(2.8,1,1),wood,shop,.07); cube("Home_Chair_Plinth",(17,11.7,.25),(2.4,1.5,.35),teal,shop,.08); text("Home_Table_Label","MAKE HOME",(23.4,10.95,1.2),.22,dark,labels)
cyl("Table_Lamp_Base",(17,15.4,.85),.22,.12,brass,props); cyl("Table_Lamp_Stem",(17,15.4,1.2),.035,.7,brass,props); cone("Table_Lamp_Shade",(17,15.4,1.65),.30,.18,.38,cream,props); sph("Table_Lamp_Bulb",(17,15.4,1.54),(.08,.08,.08),coral,props)
cube("Kettle_Body",(22.8,11.5,1.2),(.5,.35,.32),cream,props,.08); torus("Kettle_Handle",(22.8,11.5,1.43),.20,.035,brass,props); cone("Kettle_Spout",(23.12,11.5,1.3),.10,.025,.32,cream,props)
for i,x in enumerate((23.7,24.05)):
    cyl(f"Mug_{i+1}",(x,11.45,1.15),.09,.16,pink,props,16); torus(f"Mug_Handle_{i+1}",(x+.09,11.45,1.2),.07,.02,pink,props)
for i,m in enumerate((pink,sage,cream)): cube(f"Cushion_{i+1}",(18.3+i*.55,11.65,.72),(.45,.18,.45),m,props,.1)
cube("Storage_Box",(20,15.15,.55),(.55,.4,.32),teal,props,.05); cube("Storage_Box_Lid",(20,15.15,.73),(.6,.44,.06),cream,props,.02)
cyl("Plant_Pot",(21,15.15,.55),.18,.28,coral,props); sph("Plant_Leaves",(21,15.15,1.05),(.48,.38,.58),sage,props); cyl("Vase",(22.2,15.15,.75),.16,.5,cream,props); sph("Vase_Flowers",(22.2,15.15,1.18),(.28,.22,.28),pink,props)
cube("Folding_Chair_Seat",(18,14.8,.62),(.55,.55,.1),wood,props,.04); cube("Folding_Chair_Back",(18,15.04,1.1),(.55,.1,.85),sage,props,.04)
for i,x in enumerate((17.8,18.2)): cube(f"Folding_Chair_Leg_{i+1}",(x,14.65,.3),(.07,.07,.55),brass,props,.02)
bpy.ops.object.camera_add(location=(26.0,19.0,3.5)); cam=bpy.context.view_layer.objects.active; cam.name="Home_Nook_Detail_Camera"; aim(cam,(23.4,12.4,1.35)); cam.data.lens=36; scene.camera=cam
bpy.ops.object.light_add(type="AREA",location=(20,12,8)); l=bpy.context.view_layer.objects.active; l.name="Home_Detail_Softbox"; l.data.energy=1400; l.data.size=7; aim(l,(20,14,1))
bpy.ops.object.light_add(type="AREA",location=(25,20,4)); f=bpy.context.view_layer.objects.active; f.name="Home_Aisle_Fill"; f.data.energy=900; f.data.size=5; aim(f,(20,14,1.2))
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1200,850,80; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=1.2; scene.render.filepath=str(WIDE); bpy.ops.render.render(write_still=True)
bpy.ops.object.camera_add(location=(27.0,18.5,2.8)); pc=bpy.context.view_layer.objects.active; pc.name="Home_Nook_Props_Camera"; aim(pc,(23.4,11.8,1.2)); pc.data.lens=50; scene.camera=pc; scene.render.filepath=str(PROPS); bpy.ops.render.render(write_still=True); scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=str(OUT)); print(f"Saved Home Nook scene to {OUT}")
