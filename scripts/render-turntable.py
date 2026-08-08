"""Render a 360 deg Z-axis turntable of the avatar as transparent PNG frames.

  blender --background <file.blend> --python scripts/render-turntable.py

Env vars:
  TT_OUT      output directory (default ./frames)
  TT_FRAMES   frame count (default 24)
  TT_SIZE     square render size (default 512)
  TT_NEUTRAL  "1" to unlink the world environment texture, killing the magenta
              cast that a *missing* HDRI produces
  TT_BG       neutral grey level used with TT_NEUTRAL (default 0.285)
  TT_ONE      "1" to render only frame 0, for quick comparisons

Feed the output to scripts/dither-avatar.mjs --in.
Never saves the .blend.
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from avatar_blender_common import (  # noqa: E402
    env,
    report_images,
    setup_sprite_output,
    spin_pivot,
    turntable,
    use_gpu,
)

FRAMES = env("TT_FRAMES", "24", int)
SIZE = env("TT_SIZE", "512", int)
NEUTRAL = env("TT_NEUTRAL", "") == "1"
ONE = env("TT_ONE", "") == "1"
# 0.285 is magenta's luminance, so this keeps the ambient level the missing HDRI
# contributed while dropping its cast. Lower is darker and more contrasty.
BG = env("TT_BG", "0.285", float)

OUT = env("TT_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "frames"))

scene = bpy.context.scene

use_gpu(scene)
report_images()

if NEUTRAL:
    world = scene.world
    background = world.node_tree.nodes.get("Background")
    for link in list(background.inputs["Color"].links):
        world.node_tree.links.remove(link)
    background.inputs["Color"].default_value = (BG, BG, BG, 1.0)
    print(f"[avatar] world environment unlinked, background grey {BG}", flush=True)

setup_sprite_output(scene, SIZE, samples=64)
turntable(scene, OUT, FRAMES, 1 if ONE else FRAMES, spin_pivot(scene))
