import * as riveCanvasModule from "@rive-app/canvas";
import type { StateMachineInput } from "@rive-app/canvas";
import { createSignal, onCleanup, onMount } from "solid-js";

const riveCjsExports = riveCanvasModule as Record<string, unknown> & {
  default?: Record<string, unknown>;
};
const { Rive, Layout, Fit, Alignment } = (
  riveCjsExports.default?.Rive ? riveCjsExports.default : riveCjsExports
) as typeof import("@rive-app/canvas");

const rifleDesignAspectRatio = 950 / 540;

export default function Rifle1(props: { rivUrl: string }) {
  const [canvasElement, setCanvasElement] = createSignal<HTMLCanvasElement | null>(null);
  const [drawWidth, setDrawWidth] = createSignal(950);
  const [loadMessage, setLoadMessage] = createSignal<string | null>(null);

  onMount(() => {
    let riveInstance: InstanceType<typeof Rive> | undefined;
    let keepShootingInput: StateMachineInput | undefined;
    let syncCheckboxToRiveInput: (() => void) | undefined;
    const keepShootingCheckbox = document.getElementById(
      "keep-shooting",
    ) as HTMLInputElement | null;

    const handleWindowResize = () => {
      setDrawWidth(Math.min(innerWidth * 0.9, 950));
      riveInstance?.resizeDrawingSurfaceToCanvas();
    };

    const { rivUrl } = props;
    if (!rivUrl) {
      setLoadMessage("Missing animation URL.");
      return;
    }

    queueMicrotask(() => {
      const canvas = canvasElement();
      if (!canvas) {
        setLoadMessage("Canvas not ready.");
        return;
      }
      try {
        syncCheckboxToRiveInput = () => {
          if (keepShootingInput && keepShootingCheckbox) {
            keepShootingInput.value = keepShootingCheckbox.checked;
          }
        };
        riveInstance = new Rive({
          src: rivUrl,
          canvas,
          stateMachines: "rifle",
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
          onLoad: () => {
            riveInstance?.resizeDrawingSurfaceToCanvas();
            setLoadMessage("");
            keepShootingInput = riveInstance
              ?.stateMachineInputs("rifle")
              ?.find((input: StateMachineInput) => input.name === "keep_shooting");
            if (keepShootingCheckbox && syncCheckboxToRiveInput) {
              keepShootingCheckbox.addEventListener("change", syncCheckboxToRiveInput);
            }
          },
          onLoadError: () => setLoadMessage("Could not load the Rive file."),
        });
      } catch (error) {
        setLoadMessage(error instanceof Error ? error.message : "Failed to load");
      }
    });

    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();

    onCleanup(() => {
      window.removeEventListener("resize", handleWindowResize);
      if (keepShootingCheckbox && syncCheckboxToRiveInput) {
        keepShootingCheckbox.removeEventListener("change", syncCheckboxToRiveInput);
      }
      riveInstance?.stopRendering();
      riveInstance?.cleanup();
    });
  });

  return (
    <div class="flex flex-col justify-center w-fit h-fit text-white p-4">
      <h1>Rifle animation</h1>
      <p>Interactive animation made in rive.app using an illustration made by me</p>
      <p>
        click on the rifle or on the <span class="font-bold">S</span> and on the{" "}
        <span class="font-bold">R</span> to reload
      </p>

      {loadMessage() === null ? (
        <p class="text-neutral-400 text-sm mb-2" aria-live="polite">
          Loading animation…
        </p>
      ) : null}
      {loadMessage() && loadMessage()!.length > 0 ? (
        <p class="text-red-400 text-sm mb-2" role="alert">
          {loadMessage()!}
        </p>
      ) : null}

      <div class="flex flex-col relative">
        <div class="flex gap-2 items-center justify-center absolute top-10 left-10 z-10">
          <input type="checkbox" id="keep-shooting" name="continuous-shooting" />
          <label for="keep-shooting">Continuous Shooting</label>
        </div>
        <div class={loadMessage() === null ? "opacity-40 pointer-events-none" : ""}>
          <canvas
            ref={setCanvasElement}
            width={drawWidth()}
            height={drawWidth() / rifleDesignAspectRatio}
            style={{
              width: `${drawWidth()}px`,
              height: `${drawWidth() / rifleDesignAspectRatio}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
