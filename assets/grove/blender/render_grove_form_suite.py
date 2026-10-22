import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RENDER_DIR = ROOT / "renders" / "form-suite"
RENDER_DIR.mkdir(parents=True, exist_ok=True)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 70
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.15

review = bpy.data.collections.get("GROVE_FORM_REVIEW_TEMP")
if review:
    for obj in list(review.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(review)
review = bpy.data.collections.new("GROVE_FORM_REVIEW_TEMP")
scene.collection.children.link(review)

bpy.ops.object.light_add(type="AREA", location=(0, 0, 13.8))
softbox = bpy.context.object
softbox.name = "Grove_Form_Suite_Softbox"
softbox.data.energy = 1800
softbox.data.shape = "DISK"
softbox.data.size = 18
aim(softbox, (0, 0, 2.5))
for old in list(softbox.users_collection):
    old.objects.unlink(softbox)
review.objects.link(softbox)

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = "Grove_Form_Suite_Camera"
for old in list(camera.users_collection):
    old.objects.unlink(camera)
review.objects.link(camera)
scene.camera = camera

views = (
    ("corner_southwest", (-4.2, -4.2, 3.4), (0.0, 0.0, 4.2), 16),
    ("corner_southeast", (4.2, -4.2, 3.4), (0.0, 0.0, 4.2), 16),
    ("corner_northeast", (4.2, 4.2, 3.4), (0.0, 0.0, 4.2), 16),
    ("corner_northwest", (-4.2, 4.2, 3.4), (0.0, 0.0, 4.2), 16),
    ("ceiling_center_up", (4.6, 0.0, 1.6), (4.6, 0.0, 14.6), 15),
    ("ceiling_oblique_south", (0.0, -8.2, 2.1), (0.0, 0.0, 13.6), 16),
    ("ceiling_oblique_north", (0.0, 8.2, 2.1), (0.0, 0.0, 13.6), 16),
)

for name, location, target, lens in views:
    camera.location = location
    camera.data.lens = lens
    aim(camera, target)
    scene.render.filepath = str(RENDER_DIR / f"grove_{name}.png")
    bpy.ops.render.render(write_still=True)
    print("GROVE_FORM_RENDER", name, scene.render.filepath)

print("GROVE_FORM_SUITE_READY", RENDER_DIR)
