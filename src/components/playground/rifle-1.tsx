import type { Rive, StateMachineInput } from "@rive-app/canvas";
import { createSignal, onCleanup, onMount } from "solid-js";

const Illustrations = () => {
  let canvas: HTMLCanvasElement | undefined;
  const [riveRef, setRiveRef] = createSignal<Rive | undefined>();
  const [keepShootingInput, setKeepShootingInput] = createSignal<
    StateMachineInput | undefined
  >();
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);

  const [canvasWidth, setCanvasWidth] = createSignal(950);
  const [canvasHeight, setCanvasHeight] = createSignal(540);

  const updateCanvasSize = () => {
    const screenWidth = window.innerWidth;
    const newCanvasWidth = Math.min(screenWidth * 0.9, 950);
    const aspectRatio = 950 / 540;
    const newCanvasHeight = newCanvasWidth / aspectRatio;
    setCanvasWidth(newCanvasWidth);
    setCanvasHeight(newCanvasHeight);
  };

  onMount(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    const keepShootingCheckbox = document.getElementById(
      "keep-shooting",
    ) as HTMLInputElement | null;

    let rInstance: Rive | undefined;
    let handleOnChange: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const [{ Rive }, rivMod] = await Promise.all([
          import("@rive-app/canvas"),
          import("../../riveAnimations/rifle.riv?url"),
        ]);
        const rivUrl = rivMod.default as string;
        if (cancelled || !canvas) return;

        handleOnChange = () => {
          const input = keepShootingInput();
          if (input && keepShootingCheckbox) {
            input.value = keepShootingCheckbox.checked;
          }
        };

        const r = new Rive({
          src: rivUrl,
          autoplay: true,
          canvas,
          stateMachines: ["rifle"],
          onLoad: () => {
            if (cancelled) return;
            r.resizeDrawingSurfaceToCanvas();
            rInstance = r;
            setRiveRef(r);
            setIsLoading(false);
            const inputs = r.stateMachineInputs("rifle");
            const keep_shooting = inputs?.find((i) => i.name === "keep_shooting");
            if (keep_shooting) {
              setKeepShootingInput(keep_shooting);
            }
            if (keepShootingCheckbox && handleOnChange) {
              keepShootingCheckbox.addEventListener("change", handleOnChange);
            }
          },
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load animation");
          setIsLoading(false);
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
      window.removeEventListener("resize", updateCanvasSize);
      if (keepShootingCheckbox && handleOnChange) {
        keepShootingCheckbox.removeEventListener("change", handleOnChange);
      }
      const r = rInstance ?? riveRef();
      if (r) {
        r.stopRendering();
        r.cleanup();
      }
    });
  });

  return (
    <div class="flex flex-col justify-center w-fit h-fit text-white p-4">
      <h1>Rifle animation</h1>
      <p>
        Interactive animation made in rive.app using an illustration made by me
      </p>
      <p>
        click on the rifle or on the <span class="font-bold">S</span> and on the{" "}
        <span class="font-bold">R</span> to reload
      </p>

      {isLoading() ? (
        <p class="text-neutral-400 text-sm mb-2" aria-live="polite">
          Loading animation…
        </p>
      ) : null}
      {loadError() ? (
        <p class="text-red-400 text-sm mb-2" role="alert">
          {loadError()}
        </p>
      ) : null}

      <div class="flex flex-col relative">
        <div class="flex gap-2 items-center justify-center absolute top-10 left-10 z-10">
          <input
            type="checkbox"
            id="keep-shooting"
            name="continuous-shooting"
          />
          <label for="keep-shooting">Continuous Shooting</label>
        </div>
        <div class={isLoading() ? "opacity-40 pointer-events-none" : ""}>
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
