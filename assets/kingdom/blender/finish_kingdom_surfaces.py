"""Original packed textures and daylight finish, confined to Kingdom."""
import bpy
import numpy as np
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'blender/kingdom_island.blend'
if Path(bpy.data.filepath).resolve()!=SOURCE.resolve(): raise RuntimeError('Kingdom file required')

def rgb(h): return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)])

def tex(name,arr):
    height,width=arr.shape[:2]
    image=bpy.data.images.get(name) or bpy.data.images.new(name,width,height,alpha=False)
    pixels=np.ones((height,width,4),dtype=np.float32); pixels[:,:,:3]=arr
    image.pixels.foreach_set(pixels.ravel()); image.pack()
    return image

size=256; yy,xx=np.mgrid[:size,:size]; rng=np.random.default_rng(34)
noise=rng.uniform(-.006,.006,(size,size,1))
checks=((xx//128+yy//128)%2)[...,None]
grass=tex('Kingdom_Grass_Checker',np.clip(np.where(checks==0,rgb('5CC83C'),rgb('55C138'))+noise,0,1))

# Staggered, softly rounded sandstone pavers; only colour is stored in the image.
row=yy//32; u=(xx+(row%2)*32)%64; v=yy%32
corners=np.maximum(np.abs(u-31.5)-25.5,0)**2+np.maximum(np.abs(v-15.5)-9.5,0)**2
inside=(corners<24)&(u>2)&(u<61)&(v>2)&(v<29)
variation=((xx//64+row*3)%5)[...,None]*.013
col=np.clip(rgb('FFF1D0')-variation+noise,0,1)
paving=tex('Kingdom_Sandstone_Paving',np.where(inside[...,None],col,rgb('DBC48C')))

phase=yy/256*np.pi*12
wave=np.sin(phase+.7*np.sin(xx/256*np.pi*4))
line=np.maximum(0,(wave-.93)/.07)[...,None]
water=tex('Kingdom_Lagoon_Ripples',rgb('3ED6E0')*(1-line*.18)+rgb('80E9E9')*line*.18)

def bind(material,image):
    nt=material.node_tree; bs=nt.nodes.get('Principled BSDF')
    node=nt.nodes.get('Kingdom_surface_texture') or nt.nodes.new('ShaderNodeTexImage')
    node.name='Kingdom_surface_texture'; node.image=image; node.interpolation='Linear'; node.extension='REPEAT'
    nt.links.new(node.outputs['Color'],bs.inputs['Base Color'])

bind(bpy.data.materials['KI_lawn'],grass)
bind(bpy.data.materials['KI_water'],water)
path_mat=bpy.data.materials.get('KI_paving') or bpy.data.materials['KI_cream'].copy()
path_mat.name='KI_paving'; bind(path_mat,paving)
path=bpy.data.objects['Arrival_to_house']; path.data.materials.clear(); path.data.materials.append(path_mat)
for poly in path.data.polygons: poly.material_index=0

def planar_uv(obj,tile):
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Kingdom_world_uv')
    for poly in obj.data.polygons:
        for idx in poly.loop_indices:
            point=obj.matrix_world@obj.data.vertices[obj.data.loops[idx].vertex_index].co
            uv.data[idx].uv=(point.x/tile,point.y/tile)

scene=bpy.context.scene
sea=bpy.data.objects['Sea']; sea.dimensions=(2000,2000,.4)
bpy.context.view_layer.update()
for ob in scene.objects:
    if ob.type!='MESH': continue
    mats={m.name for m in ob.data.materials if m}
    if 'KI_lawn' in mats: planar_uv(ob,5)
    elif 'KI_paving' in mats: planar_uv(ob,1.8)
    elif 'KI_water' in mats: planar_uv(ob,12)
    if ob.name.startswith('Cloud_'): ob.visible_shadow=False
for ob in scene.objects:
    if ob.type=='CAMERA': ob.data.clip_end=3000
scene.view_settings.exposure=-.2
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
scene['surface_notes']='Packed original texture images: grass, sandstone paving and lagoon ripples. No external texture dependencies.'
scene.camera=bpy.data.objects['Kingdom_Overview']
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
