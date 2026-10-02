import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
BLOCKOUT=ROOT/"blender"/"grove_blockout.blend"
OUT=ROOT/"blender"/"cafe_canopy_detail.blend"
WIDE=ROOT/"renders"/"cafe_canopy_detail.png"
PROPS=ROOT/"renders"/"cafe_canopy_props.png"

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

def sph(n,p,s,m,c):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); move(o,c); return o

def torus(n,p,major,minor,m,c,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=p,rotation=rot); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def text(n,s,p,size,m,c,rot=(math.radians(90),0,0)):
    bpy.ops.object.text_add(location=p,rotation=rot); o=bpy.context.view_layer.objects.active; o.name=n; o.data.body=s; o.data.align_x="CENTER"; o.data.size=size; o.data.extrude=.01; o.data.materials.append(m); move(o,c)

def aim(o,t): o.rotation_euler=(Vector(t)-o.location).to_track_quat("-Z","Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT)); scene=bpy.context.scene
shop,props,labels=C("CAFE_CANOPY_DETAIL"),C("CAFE_CANOPY_INDIVIDUAL_PROPS"),C("CAFE_CANOPY_LABELS")
floor=M("Cafe_Floor",(.37,.29,.22),.82); wood=M("Cafe_Wood",(.40,.18,.08),.72); cream=M("Cafe_Cream",(.96,.82,.59),.7); coral=M("Cafe_Coral",(.92,.35,.27),.62); mint=M("Cafe_Mint",(.38,.68,.55),.68); pink=M("Cafe_Pink",(.92,.51,.58),.65); gold=M("Cafe_Gold",(.83,.50,.13),.35,.5); coffee=M("Cafe_Coffee",(.18,.07,.03),.74); glass=M("Cafe_Glass",(.40,.78,.78),.18); dark=M("Cafe_Dark",(.06,.08,.09),.48)
cube("Cafe_Floor_Inset",(-20,14,.04),(11,5.6,.08),floor,shop,.02)
cube("Cafe_Service_Counter",(-20,12.7,.75),(7.8,1.15,1.35),wood,shop,.08); cube("Cafe_Counter_Top",(-20,12.7,1.47),(8.0,1.25,.12),cream,shop,.03)
cube("Cafe_Display_Glass",(-22.2,13.1,2.0),(2.6,.7,1.0),glass,shop,.05); cube("Cafe_Display_Base",(-22.2,13.1,1.53),(2.7,.8,.12),gold,shop,.03)
cube("Cafe_Menu_Board",(-20,10.95,3.2),(4.8,.14,1.8),dark,shop,.06); text("Cafe_Menu_Title","CAFE CANOPY",(-20,11.04,3.58),.3,cream,labels,rot=(math.radians(90),0,math.radians(180)))
for i,x in enumerate((-23.8,-20,-16.2)):
    cyl(f"Cafe_Table_{i+1}",(x,16.1,.78),.72,.10,wood,shop); cyl(f"Cafe_Table_Stem_{i+1}",(x,16.1,.42),.08,.7,gold,shop)
    for j,dx in enumerate((-.8,.8)):
        cyl(f"Cafe_Stool_{i+1}_{j+1}",(x+dx,16.1,.52),.28,.14,coral,shop); cyl(f"Cafe_Stool_Leg_{i+1}_{j+1}",(x+dx,16.1,.27),.06,.5,gold,shop)
for i,x in enumerate((-23.0,-22.3,-21.6)):
    cyl(f"Coffee_Cup_{i+1}",(x,12.55,1.68),.11,.22,cream,props,20); torus(f"Coffee_Handle_{i+1}",(x+.12,12.55,1.7),.07,.02,cream,props,rot=(math.radians(90),0,0)); cyl(f"Coffee_Surface_{i+1}",(x,12.55,1.80),.095,.01,coffee,props,20)
for i,x in enumerate((-22.9,-22.2,-21.5)):
    torus(f"Croissant_{i+1}",(x,13.48,1.78),.14,.055,gold,props,rot=(math.radians(90),0,0))
for i,x in enumerate((-20.5,-19.8)):
    cube(f"Cake_Slice_{i+1}",(x,12.5,1.67),(.35,.28,.22),pink,props,.04); cube(f"Cake_Cream_{i+1}",(x,12.5,1.80),(.36,.29,.05),cream,props,.02)
for i,x in enumerate((-18.7,-18.0)):
    cube(f"Sandwich_{i+1}_Bread",(x,12.5,1.67),(.42,.30,.18),cream,props,.05); cube(f"Sandwich_{i+1}_Filling",(x,12.48,1.67),(.38,.31,.05),mint,props,.02)
for i,x in enumerate((-23.0,-22.2,-21.4,-20.4,-19.7,-18.7,-18.0)): cyl(f"Cafe_Plate_{i+1}",(x,12.5,1.55),.18,.025,cream,props,24)
sph("Cafe_Counter_Plant",(-16.8,12.5,1.85),(.32,.32,.45),mint,props); cyl("Cafe_Counter_Plant_Pot",(-16.8,12.5,1.58),.16,.28,coral,props)
bpy.ops.object.camera_add(location=(-20,20.5,3.6)); cam=bpy.context.view_layer.objects.active; cam.name="Cafe_Canopy_Detail_Camera"; aim(cam,(-20,13.4,1.4)); cam.data.lens=38; scene.camera=cam
bpy.ops.object.light_add(type="AREA",location=(-20,16,8)); l=bpy.context.view_layer.objects.active; l.name="Cafe_Softbox"; l.data.energy=1500; l.data.size=8; aim(l,(-20,13,1))
bpy.ops.object.light_add(type="AREA",location=(-15,19,4)); f=bpy.context.view_layer.objects.active; f.name="Cafe_Fill"; f.data.energy=850; f.data.size=5; aim(f,(-20,14,1.2))
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1200,850,80; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=1.1; scene.render.filepath=str(WIDE); bpy.ops.render.render(write_still=True)
bpy.ops.object.camera_add(location=(-15.5,18.0,2.8)); pc=bpy.context.view_layer.objects.active; pc.name="Cafe_Canopy_Props_Camera"; aim(pc,(-20,12.7,1.75)); pc.data.lens=52; scene.camera=pc; scene.render.filepath=str(PROPS); bpy.ops.render.render(write_still=True); scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=str(OUT)); print(f"Saved Cafe Canopy scene to {OUT}")
