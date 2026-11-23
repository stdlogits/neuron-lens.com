"""Renders one figure's mesh in Cycles, on nothing. Run by Blender (figures.py does):
    blender -b --python blend.py -- <in.ply> <out.png> <elev degrees> <zoom> <r,g,b> <size> [samples]

The mesh carries each vertex's colour and, in alpha, what kind of part it is (mesh.py). The figure is soft clay: light
goes a little way into it, so it does not read as flat plastic. A large white key from the upper left, a fill and two
edge lights in the layer's colour, and only a little light from everywhere else, so its shadows keep their depth."""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
ply, out, elev, zoom = argv[0], argv[1], float(argv[2]), float(argv[3])
tint = [int(v) / 255 for v in argv[4].split(",")]
size, samples = int(argv[5]), int(argv[6]) if len(argv) > 6 else 160
lin = lambda c: [v ** 2.2 for v in c]
mix = lambda a, b, s: [x * (1 - s) + y * s for x, y in zip(a, b)]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.wm.ply_import(filepath=ply)
obj = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()
names = [a.name for a in obj.data.color_attributes]
print("colour attributes:", names)

mat = bpy.data.materials.new("clay")
try:
    mat.use_nodes = True
except Exception:
    pass
tree = mat.node_tree
bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
print("inputs:", [i.name for i in bsdf.inputs])
attr = tree.nodes.new("ShaderNodeAttribute")
attr.attribute_name = names[0]
link = tree.links.new
link(attr.outputs["Color"], bsdf.inputs["Base Color"])


def ranged(lo, hi, a, b):
    """The kind in alpha, mapped from lo..hi to a..b and held at the ends."""
    node = tree.nodes.new("ShaderNodeMapRange")
    node.clamp = True
    node.inputs["From Min"].default_value, node.inputs["From Max"].default_value = lo, hi
    node.inputs["To Min"].default_value, node.inputs["To Max"].default_value = a, b
    link(attr.outputs["Alpha"], node.inputs["Value"])
    return node.outputs["Result"]


def put(name, value):
    if name in bsdf.inputs:
        if hasattr(value, "node"):
            link(value, bsdf.inputs[name])
        else:
            bsdf.inputs[name].default_value = value
    else:
        print("no input", name)


put("Roughness", ranged(0.5, 0.9, 0.07, 0.52))                 # an eye is glossy, clay is not
put("Coat Weight", ranged(0.5, 0.9, 1.0, 0.12))
put("Coat Roughness", 0.12)
put("Subsurface Weight", ranged(0.3, 0.9, 0.0, 0.42))          # light goes a little way into the clay
put("Subsurface Radius", (1.0, 0.75, 0.6))
put("Subsurface Scale", 0.11)
link(attr.outputs["Color"], bsdf.inputs["Emission Color"])
put("Emission Strength", ranged(0.0, 0.45, 2.2, 0.0))          # a glint is light itself; the moon is lit a little from within
obj.data.materials.append(mat)

# the eye: lifted by `elev`, looking at the middle
half, dist = 1.22 / zoom, 7.0
e = math.radians(elev)
cam = bpy.data.objects.new("eye", bpy.data.cameras.new("eye"))
scene.collection.objects.link(cam)
cam.location = (0, -dist * math.cos(e), dist * math.sin(e))
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.sensor_width = 36
cam.data.lens = 18 * dist / half
scene.camera = cam


def lamp(name, at, power, colour, width):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.size = power, colour, width
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = at
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()


W = [1, 1, 1]
lamp("key", (-3.6, -4.6, 5.2), 430, (1.0, 0.98, 0.95), 5.0)
lamp("fill", (4.8, -3.4, 1.0), 150, lin(mix(tint, W, 0.35)), 6.0)
lamp("edge", (3.0, 4.4, 3.4), 1000, lin(mix(tint, W, 0.25)), 3.0)
lamp("edge2", (-3.8, 3.8, 1.6), 520, lin(mix(tint, W, 0.15)), 3.0)
lamp("under", (0.0, -2.5, -4.0), 70, lin(tint), 6.0)

world = bpy.data.worlds.new("dark")
try:
    world.use_nodes = True
except Exception:
    pass
back = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
back.inputs["Color"].default_value = (*lin(mix(tint, W, 0.3)), 1)
back.inputs["Strength"].default_value = 0.07
scene.world = world

scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as err:
    print("on the processor:", err)
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("rendered", out)
