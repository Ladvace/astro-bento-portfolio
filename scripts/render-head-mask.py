"""Render an occlusion-correct head mask for the turntable.

  blender --background <file.blend> --python scripts/render-head-mask.py

Head meshes alone, body meshes as holdouts, so the mask is cut away wherever the
hood or a hand crosses in front. The mask is just the result's alpha. Same pivot
and size as render-turntable.py, so the frames need no registration. Feed to
scripts/dither-avatar.mjs --mask.

Env vars: TT_OUT (default ./masks), TT_FRAMES, TT_SIZE, TT_ONE.
Never saves the .blend.
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from avatar_blender_common import (  # noqa: E402
    BODY_MESHES,
    env,
    setup_sprite_output,
    spin_pivot,
    turntable,
    use_gpu,
)

FRAMES = env("TT_FRAMES", "24", int)
SIZE = env("TT_SIZE", "512", int)
ONE = env("TT_ONE", "") == "1"
OUT = env("TT_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "masks"))

scene = bpy.context.scene

use_gpu(scene)

# Holdouts punch transparent holes wherever the body sits in front of the head.
for name in BODY_MESHES:
    obj = bpy.data.objects.get(name)
    if obj:
        obj.is_holdout = True

# Coverage only; denoising would soften the edge.
setup_sprite_output(scene, SIZE, samples=16, denoise=False)
turntable(scene, OUT, FRAMES, 1 if ONE else FRAMES, spin_pivot(scene))
