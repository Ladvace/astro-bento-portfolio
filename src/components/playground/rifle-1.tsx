import * as rive from "@rive-app/canvas";
import rifleAnimation from "../../riveAnimations/rifle.riv";
import { createSignal, onCleanup, onMount } from "solid-js";

const Illustrations = () => {
  let canvas: HTMLCanvasElement | undefined;
  const [riveRef, setRiveRef] = createSignal<rive.Rive | undefined>();
  const [keepShootingInput, setKeepShootingInput] = createSignal<
    rive.StateMachineInput | undefined
  >();
  // Signals for canvas dimensions
  const [canvasWidth, setCanvasWidth] = createSignal(950);
  const [canvasHeight, setCanvasHeight] = createSignal(540);

  const updateCanvasSize = () => {
    const screenWidth = window.innerWidth;
    // Assuming you want the canvas to take up most of the screen width but maintain its aspect ratio
    const newCanvasWidth = Math.min(screenWidth * 0.9, 950); // Cap at original width or 90% of screen width
    console.log("TEST", screenWidth, newCanvasWidth);
    const aspectRatio = 950 / 540;
    const newCanvasHeight = newCanvasWidth / aspectRatio;
    setCanvasWidth(newCanvasWidth);
    setCanvasHeight(newCanvasHeight);
  };

  onMount(() => {
    updateCanvasSize(); // Initial size update
    window.addEventListener("resize", updateCanvasSize); // Update on resize

    const keepShootingCheckbox = document.getElementById(
      "keep-shooting"
    ) as HTMLInputElement;

    const handleOnChange = () => {
      const input = keepShootingInput();
      if (input) {
        input.value = keepShootingCheckbox.checked;
      }
    };

    if (canvas && rifleAnimation) {
      const r = new rive.Rive({
        src: rifleAnimation,
        autoplay: true,
        canvas: canvas,
        stateMachines: ["rifle"],
        onLoad: () => {
          r.resizeDrawingSurfaceToCanvas();
          setRiveRef(r);
          const inputs = r.stateMachineInputs("rifle");
          const keep_shooting = inputs?.find((i) => i.name === "keep_shooting");
          if (keep_shooting) {
            setKeepShootingInput(keep_shooting);
          }

          if (keepShootingCheckbox) {
            keepShootingCheckbox.addEventListener("change", handleOnChange);
          }
        },
      });
    }

    onCleanup(() => {
      window.removeEventListener("resize", updateCanvasSize);
      if (riveRef()) {
        riveRef()?.stopRendering();
        riveRef()?.cleanup();
      }
      if (keepShootingCheckbox) {
        keepShootingCheckbox.removeEventListener("change", handleOnChange);
      }
    });
  });

  return (
    <div class="flex flex-col justify-center w-fit h-fit text-white p-4">
      <h1>Rifle animation</h1>
      <p>
        Interactive animation made in rive.app using an
        illustration made by me
      </p>
      <p>
        click on the rifle or on the <span class="font-bold">S</span> and on the{" "}
        <span class="font-bold">R</span> to reload
      </p>

      <div class="flex flex-col relative">
        <div class="flex gap-2 items-center justify-center absolute top-10 left-10">
          <input
            type="checkbox"
            id="keep-shooting"
            name="continuous-shooting"
          />
          <label for="continuous-shooting">Continuous Shooting</label>
        </div>
        <div>
          <canvas
            ref={(el) => {
              canvas = el;
            }}
            width={canvasWidth()}
            height={canvasHeight()}
            style={{
              width: `${canvasWidth()}px`,
              height: `${canvasHeight()}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Illustrations;
