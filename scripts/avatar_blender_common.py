"""Shared setup for the turntable render passes. Nothing here saves the .blend."""

import math
import os

import bpy
from mathutils import Matrix, Vector

HEAD_MESHES = ["Testa", "Sopracciglia", "Capelli", "Occhiali"]
BODY_MESHES = ["Felpa", "Pantaloni", "Scarpe", "Mani"]
CHARACTER_MESHES = HEAD_MESHES + BODY_MESHES

SCENERY = ("Floor5x5", "Height ref")

POSE_FRAME = 1


def env(name, default, cast=str):
    return cast(os.environ.get(name, default))


def use_gpu(scene):
    """Preferences do not reliably carry into background mode."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except Exception as exc:  # fall back to CPU rather than dying
        print(f"[avatar] GPU setup failed, using CPU: {exc}", flush=True)
        scene.cycles.device = "CPU"


def report_images():
    """A missing image renders as magenta, which is worth knowing about."""
    for image in bpy.data.images:
        if image.source != "FILE":
            continue
        if image.packed_file:
            state = "packed"
        elif image.has_data:
            state = "ok"
        else:
            state = "MISSING"
        print(f"[avatar] image {image.name}: {state}", flush=True)


def setup_sprite_output(scene, size, samples, denoise=True):

    scene.render.engine = "CYCLES"
    scene.render.film_transparent = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.cycles.samples = samples
    scene.cycles.use_denoising = denoise

    for name in SCENERY:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = True

    scene.frame_set(POSE_FRAME)


def spin_pivot(scene):
    """Not the world origin: the character's XY centre is offset from it, so
    spinning about the origin would swing the sprite sideways between frames."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = Vector((1e9,) * 3)
    high = Vector((-1e9,) * 3)
    for name in CHARACTER_MESHES:
        evaluated = bpy.data.objects[name].evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for vertex in mesh.vertices:
            world = evaluated.matrix_world @ vertex.co
            for axis in range(3):
                low[axis] = min(low[axis], world[axis])
                high[axis] = max(high[axis], world[axis])
        evaluated.to_mesh_clear()

    pivot = Vector(((low.x + high.x) / 2.0, (low.y + high.y) / 2.0, 0.0))
    radius = max(
        (Vector((x, y)) - Vector((pivot.x, pivot.y))).length
        for x in (low.x, high.x)
        for y in (low.y, high.y)
    )

    camera = scene.camera.data
    print(
        f"[avatar] pivot={tuple(round(v, 4) for v in pivot)} "
        f"spin_radius={radius:.4f} ortho_scale={camera.ortho_scale:.4f}",
        flush=True,
    )
    if radius * 2 > camera.ortho_scale:
        print("[avatar] WARNING: spin would clip frame, widening ortho", flush=True)
        camera.ortho_scale = radius * 2 * 1.06

    return pivot


def turntable(scene, out_dir, frames, count, pivot):

    os.makedirs(out_dir, exist_ok=True)
    group = bpy.data.objects["char_grp"]
    base = group.matrix_world.copy()
    to_pivot = Matrix.Translation(pivot)

    for index in range(count):
        degrees = index * (360.0 / frames)
        group.matrix_world = (
            to_pivot
            @ Matrix.Rotation(math.radians(degrees), 4, "Z")
            @ to_pivot.inverted()
            @ base
        )
        bpy.context.view_layer.update()
        scene.render.filepath = os.path.join(out_dir, f"frame_{index:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[avatar] frame {index + 1}/{count}  {degrees:6.1f} deg", flush=True)

    group.matrix_world = base
    print(f"[avatar] DONE {count} frames -> {out_dir}", flush=True)
