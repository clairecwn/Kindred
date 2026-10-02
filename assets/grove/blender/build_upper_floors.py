import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
BLOCKOUT=ROOT/"blender"/"grove_blockout.blend"
OUT=ROOT/"blender"/"grove_upper_floors.blend"
RENDERS=ROOT/"renders"

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

def cyl(n,p,r,d,m,c,v=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def sph(n,p,s,m,c):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=p); o=bpy.context.view_layer.objects.active; o.name=n; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); move(o,c); return o

def torus(n,p,major,minor,m,c,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=p,rotation=rot); o=bpy.context.view_layer.objects.active; o.name=n; o.data.materials.append(m); move(o,c); return o

def text(n,s,p,size,m,c,rot):
    bpy.ops.object.text_add(location=p,rotation=rot); o=bpy.context.view_layer.objects.active; o.name=n; o.data.body=s; o.data.align_x="CENTER"; o.data.size=size; o.data.extrude=.01; o.data.materials.append(m); move(o,c)

def aim(o,t): o.rotation_euler=(Vector(t)-o.location).to_track_quat("-Z","Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT)); scene=bpy.context.scene
wall=M("Upper_Wall",(.91,.79,.61),.78); cream=M("Upper_Cream",(.96,.86,.69),.7); wood=M("Upper_Wood",(.39,.20,.10),.74); dark=M("Upper_Dark",(.06,.08,.11),.5); gold=M("Upper_Gold",(.82,.50,.14),.35,.5); coral=M("Upper_Coral",(.94,.40,.34),.62); blue=M("Upper_Blue",(.25,.45,.74),.62); mint=M("Upper_Mint",(.43,.68,.56),.68); lavender=M("Upper_Lavender",(.57,.42,.76),.64); pink=M("Upper_Pink",(.93,.48,.58),.65); green=M("Upper_Green",(.24,.58,.30),.74); water=M("Upper_Water",(.18,.60,.78),.25)

def shell(shop_id,title,x,y,z,accent):
    c=C(shop_id.upper()+"_DETAIL"); props=C(shop_id.upper()+"_PROPS"); labels=C(shop_id.upper()+"_LABELS")
    cube(shop_id+"_floor",(x,y,z+.04),(11,5.6,.08),accent,c,.02)
    back_y=y-3.25 if y<0 else y+3.25; front_y=y+3.15 if y<0 else y-3.15
    cube(shop_id+"_back",(x,back_y,z+2.5),(12,.35,5),wall,c,.08); cube(shop_id+"_left",(x-5.8,y,z+2.5),(.35,6.5,5),wall,c,.08); cube(shop_id+"_right",(x+5.8,y,z+2.5),(.35,6.5,5),wall,c,.08)
    cube(shop_id+"_sign",(x,front_y,z+4.55),(7.5,.18,.9),accent,c,.12)
    ry=math.radians(90) if y<0 else math.radians(-90); rz=math.radians(180) if y<0 else 0
    text(shop_id+"_title",title,(x,front_y+(.10 if y<0 else -.10),z+4.65),.30,dark,labels,(ry,0,rz))
    return c,props

def shelf_wall(prefix,x,y,z,c):
    cube(prefix+"_panel",(x,y,z+2.15),(4.6,.35,3.5),wood,c,.06)
    for dz in (1.2,2.1,3.0): cube(prefix+f"_shelf_{dz}",(x,y+(.28 if y<0 else -.28),z+dz),(4.2,.65,.10),gold,c,.02)

pixel,pixelp=shell("pixel_pantry","PIXEL PANTRY",20,-14,5,blue); shelf_wall("pixel",20,-16.9,5,pixel)
cube("pixel_counter",(20,-11.6,5.65),(5.8,1.0,1.1),wood,pixel,.08)
for i,x in enumerate((18.5,19.5,20.5,21.5)):
    cube(f"Game_Box_{i+1}",(x,-16.5,6.3),(.55,.18,.75),coral if i%2==0 else mint,pixelp,.04)
    cube(f"Game_Console_{i+1}",(x,-11.6,6.32),(.75,.42,.18),dark,pixelp,.06)
for i,x in enumerate((18.7,20,21.3)):
    cube(f"Controller_{i+1}",(x,-11.1,6.2),(.55,.30,.16),lavender,pixelp,.08); cyl(f"Controller_Button_{i+1}",(x+.13,-10.93,6.3),.035,.03,coral,pixelp,12)
for i,x in enumerate((18.8,20,21.2)): torus(f"Headphones_{i+1}",(x,-16.45,7.35),.25,.055,pink,pixelp,rot=(math.radians(90),0,0))
for i,x in enumerate((18.5,19.5,20.5,21.5)): sph(f"Collectible_{i+1}",(x,-16.5,8.25),(.16,.16,.22),mint if i%2==0 else coral,pixelp)

maker,makerp=shell("maker_meadow","MAKER MEADOW",-20,14,5,mint); shelf_wall("maker",-20,16.9,5,maker)
cube("maker_table",(-20,12.1,5.72),(6.5,2.0,1.2),wood,maker,.08)
for i,x in enumerate((-22.2,-21.3,-20.4)): sph(f"Yarn_Ball_{i+1}",(x,12.1,6.45),(.22,.22,.22),pink if i%2==0 else lavender,makerp)
for i,x in enumerate((-19.3,-18.5)): cyl(f"Paint_Can_{i+1}",(x,12.1,6.42),.18,.38,blue if i==0 else coral,makerp); torus(f"Paint_Handle_{i+1}",(x,12.1,6.65),.16,.02,gold,makerp)
cube("Toolbox",(-17.7,12.1,6.35),(.8,.45,.38),coral,makerp,.06); torus("Toolbox_Handle",(-17.7,12.1,6.65),.23,.035,gold,makerp)
cube("Sewing_Machine_Base",(-20,16.5,6.25),(1.2,.55,.25),cream,makerp,.05); cube("Sewing_Machine_Arm",(-20.3,16.5,6.65),(.55,.45,.65),lavender,makerp,.08); cyl("Sewing_Spool",(-20.3,16.5,7.08),.08,.18,pink,makerp)

season,seasonp=shell("seasonal_pop_up","SEASONAL POP-UP",20,14,5,coral)
for i,(x,y) in enumerate(((18,12.3),(22,12.3),(18,15.7),(22,15.7))): cyl(f"Season_Pedestal_{i+1}",(x,y,5.7),.75,1.2,cream if i%2==0 else mint,season)
for i,(x,y) in enumerate(((18,12.3),(22,12.3),(18,15.7),(22,15.7))):
    cube(f"Gift_Box_{i+1}",(x,y,6.45),(.72,.60,.48),pink if i%2==0 else blue,seasonp,.08); cube(f"Gift_Ribbon_{i+1}",(x,y,6.72),(.12,.62,.08),gold,seasonp,.02)
for i,x in enumerate((19,20,21)): cyl(f"Lantern_{i+1}",(x,14,6.0),.22,.55,gold,seasonp); sph(f"Lantern_Glow_{i+1}",(x,14,6.0),(.12,.12,.18),cream,seasonp)
cyl("Display_Tree_Trunk",(20,16.2,6.2),.16,1.7,wood,seasonp); sph("Display_Tree_Canopy",(20,16.2,7.4),(1.1,.8,1.25),green,seasonp)

books,bookp=shell("book_burrow","BOOK BURROW",-20,-14,10,wood); shelf_wall("book",-20,-16.9,10,books)
for row,z in enumerate((11.2,12.1,13.0)):
    for i,x in enumerate((-21.8,-21.2,-20.6,-20,-19.4,-18.8)):
        cube(f"Book_{row}_{i}",(x,-16.52,z),(.42,.18,.62),[coral,blue,mint,lavender,pink][(row+i)%5],bookp,.025)
for i,x in enumerate((-22,-18)): cube(f"Reading_Chair_{i+1}",(x,-12.3,10.65),(1.4,1.1,1.0),lavender if i==0 else mint,books,.16)
cube("Book_Table",(-20,-12.4,10.55),(2.2,1.2,.8),cream,books,.10)
for i,z in enumerate((11.05,11.22,11.39)): cube(f"Book_Stack_{i+1}",(-20,-12.4,z),(1.0,.72,.14),coral if i==0 else blue if i==1 else mint,bookp,.03)

well,wellp=shell("wellness_willow","WELLNESS WILLOW",20,-14,10,green)
for i,x in enumerate((17,19,21,23)): cube(f"Yoga_Mat_{i+1}",(x,-14,10.16),(1.25,3.2,.12),[lavender,mint,coral,blue][i],wellp,.06)
cube("Wellness_Counter",(20,-16.2,10.65),(6.5,1.0,1.1),wood,well,.08)
for i,x in enumerate((18.2,19.0,19.8,20.6,21.4)): cyl(f"Wellness_Bottle_{i+1}",(x,-16.2,11.45),.09,.34,mint if i%2==0 else lavender,wellp,16); cyl(f"Bottle_Cap_{i+1}",(x,-16.2,11.65),.055,.08,gold,wellp,12)
for i,x in enumerate((18.5,20,21.5)): cyl(f"Candle_{i+1}",(x,-11.8,10.35),.14,.30,cream,wellp,20); sph(f"Candle_Flame_{i+1}",(x,-11.8,10.58),(.05,.05,.09),coral,wellp)
for i,x in enumerate((18.2,19,19.8)): cyl(f"Meditation_Cushion_{i+1}",(x,-12.8,10.28),.42,.18,pink if i%2==0 else blue,wellp)

food,foodp=shell("food_hall","FOOD HALL",-20,14,10,gold)
for i,x in enumerate((-23,-20,-17)): cube(f"Food_Stall_{i+1}",(x,12.1,10.8),(2.6,1.2,1.5),wood,food,.08); cube(f"Food_Stall_Top_{i+1}",(x,12.1,11.6),(2.7,1.3,.12),cream,food,.03)
for i,x in enumerate((-23,-20,-17)): cube(f"Food_Tray_{i+1}",(x,12.1,11.75),(1.1,.7,.08),dark,foodp,.03); cyl(f"Food_Bowl_{i+1}",(x-.25,12.1,11.9),.20,.18,coral if i%2==0 else mint,foodp); cyl(f"Drink_Cup_{i+1}",(x+.32,12.1,11.95),.11,.38,blue,foodp,16)
for i,x in enumerate((-23.5,-21.8,-18.2,-16.5)): cyl(f"Food_Stool_{i+1}",(x,15.5,10.55),.30,.16,coral,food); cyl(f"Food_Stool_Leg_{i+1}",(x,15.5,10.28),.06,.55,gold,food)

garden,gardenp=shell("rooftop_garden","ROOFTOP GARDEN",20,14,10,green)
for i,(x,y) in enumerate(((17.5,12),(22.5,12),(17.5,16),(22.5,16))):
    cyl(f"Garden_Planter_{i+1}",(x,y,10.45),.65,.8,wood,gardenp); cyl(f"Garden_Tree_Trunk_{i+1}",(x,y,11.4),.15,1.3,wood,gardenp); sph(f"Garden_Tree_Canopy_{i+1}",(x,y,12.35),(1.0,.8,1.0),green,gardenp)
for i,y in enumerate((12.5,15.5)): cube(f"Garden_Bench_{i+1}",(20,y,10.55),(3.2,.8,.65),wood,garden,.10); cube(f"Garden_Bench_Back_{i+1}",(20,y+(.32 if i==0 else -.32),11.05),(3.2,.16,.8),mint,garden,.08)
for i,x in enumerate((18.5,20,21.5)): sph(f"Flower_Cluster_{i+1}",(x,14,10.55),(.3,.3,.35),pink if i%2==0 else coral,gardenp)

def render_view(name,loc,target):
    bpy.ops.object.camera_add(location=loc); cam=bpy.context.view_layer.objects.active; cam.name=name+"_Camera"; aim(cam,target); cam.data.lens=36; scene.camera=cam; scene.render.filepath=str(RENDERS/(name+".png")); bpy.ops.render.render(write_still=True)

def render_shop(name,x,y,z):
    camera_y=-7.2 if y<0 else 7.2
    render_view(name,(x,camera_y,z+2.8),(x,y,z+1.6))

bpy.ops.object.light_add(type="AREA",location=(0,0,20)); light=bpy.context.view_layer.objects.active; light.name="Upper_Mall_Softbox"; light.data.energy=3000; light.data.size=20; aim(light,(0,0,7))
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1400,850,75; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=1.25
render_view("level2_north_shops",(0,-5,9),(0,-14,7)); render_view("level2_south_shops",(0,5,9),(0,14,7)); render_view("level3_north_shops",(0,-5,14),(0,-14,12)); render_view("level3_south_shops",(0,5,14),(0,14,12))
render_shop("pixel_pantry_detail",20,-14,5); render_shop("maker_meadow_detail",-20,14,5); render_shop("seasonal_pop_up_detail",20,14,5)
render_shop("book_burrow_detail",-20,-14,10); render_shop("wellness_willow_detail",20,-14,10); render_shop("food_hall_detail",-20,14,10); render_shop("rooftop_garden_detail",20,14,10)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT)); print(f"Saved upper floors scene to {OUT}")
