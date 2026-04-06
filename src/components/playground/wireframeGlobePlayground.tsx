import { createSignal, type Component, type JSX } from "solid-js";
import WireframeGlobe from "./wireframeGlobe";

function settingRow(label: string, control: JSX.Element, hint?: string) {
  return (
    <>
      <label class="text-neutral-400 text-xs font-medium leading-tight">
        {label}
        {hint ? (
          <span class="block font-normal text-neutral-500 mt-0.5">{hint}</span>
        ) : null}
      </label>
      <div class="min-w-0">{control}</div>
    </>
  );
}

const WireframeGlobePlayground: Component = () => {
  const [size, setSize] = createSignal(420);
  const [latLines, setLatLines] = createSignal(10);
  const [lonLines, setLonLines] = createSignal(20);
  const [tiltDeg, setTiltDeg] = createSignal(20);
  const [speed, setSpeed] = createSignal(1);
  const [color, setColor] = createSignal("#a3a3a3");
  const [frontOpacity, setFrontOpacity] = createSignal(0.85);
  const [backOpacity, setBackOpacity] = createSignal(0.15);
  const [lineWidth, setLineWidth] = createSignal(0.8);
  const [segments, setSegments] = createSignal(60);
  const [autoRotate, setAutoRotate] = createSignal(true);
  const [initialAngle, setInitialAngle] = createSignal(0);

  const tiltRad = () => (tiltDeg() * Math.PI) / 180;

  return (
    <div class="flex flex-col xl:flex-row gap-10 xl:gap-12 items-start justify-center w-full max-w-6xl mx-auto">
      <div class="flex-shrink-0 mx-auto xl:mx-0">
        <WireframeGlobe
          size={size()}
          latLines={latLines()}
          lonLines={lonLines()}
          tilt={tiltRad()}
          speed={speed()}
          color={color()}
          frontOpacity={frontOpacity()}
          backOpacity={backOpacity()}
          lineWidth={lineWidth()}
          segments={segments()}
          autoRotate={autoRotate()}
          initialAngle={initialAngle()}
        />
      </div>

      <div class="w-full max-w-md border border-neutral-600 rounded-xl bg-neutral-900/80 p-5 text-neutral-100">
        <h2 class="text-lg font-semibold text-white mb-4">Settings</h2>
        <div class="grid grid-cols-1 sm:grid-cols-[minmax(7.5rem,auto)_1fr] gap-x-4 gap-y-4 items-center text-sm">
          {settingRow(
            "Size (px)",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={120}
                max={600}
                step={10}
                value={size()}
                onInput={(e) => setSize(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {size()}
              </span>
            </>
          )}

          {settingRow(
            "Latitude lines",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={2}
                max={32}
                step={1}
                value={latLines()}
                onInput={(e) => setLatLines(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {latLines()}
              </span>
            </>
          )}

          {settingRow(
            "Longitude lines",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={2}
                max={64}
                step={1}
                value={lonLines()}
                onInput={(e) => setLonLines(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {lonLines()}
              </span>
            </>
          )}

          {settingRow(
            "Tilt (°)",
            <div class="flex items-center gap-2 w-full">
              <input
                type="range"
                class="min-w-0 flex-1 accent-red-500"
                min={0}
                max={90}
                step={1}
                value={tiltDeg()}
                onInput={(e) => setTiltDeg(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums shrink-0 w-10 text-right">
                {tiltDeg()}°
              </span>
            </div>,
            "Rotation around X before projection."
          )}

          {settingRow(
            "Speed",
            <div class="flex items-center gap-2 w-full">
              <input
                type="range"
                class="min-w-0 flex-1 accent-red-500"
                min={0}
                max={3}
                step={0.05}
                value={speed()}
                onInput={(e) => setSpeed(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums shrink-0 w-10 text-right">
                {speed().toFixed(2)}
              </span>
            </div>,
            "Rotation multiplier when auto-rotate is on."
          )}

          {settingRow(
            "Line color",
            <div class="flex items-center gap-3">
              <input
                type="color"
                class="h-9 w-14 cursor-pointer rounded border border-neutral-600 bg-neutral-800 p-0.5"
                value={color()}
                onInput={(e) => setColor(e.currentTarget.value)}
              />
              <input
                type="text"
                class="flex-1 min-w-0 rounded border border-neutral-600 bg-neutral-800 px-2 py-1.5 text-xs font-mono text-neutral-200"
                value={color()}
                onInput={(e) => setColor(e.currentTarget.value)}
              />
            </div>
          )}

          {settingRow(
            "Front opacity",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={0}
                max={1}
                step={0.05}
                value={frontOpacity()}
                onInput={(e) => setFrontOpacity(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {frontOpacity().toFixed(2)}
              </span>
            </>
          )}

          {settingRow(
            "Back opacity",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={0}
                max={1}
                step={0.05}
                value={backOpacity()}
                onInput={(e) => setBackOpacity(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {backOpacity().toFixed(2)}
              </span>
            </>
          )}

          {settingRow(
            "Line width (px)",
            <>
              <input
                type="range"
                class="w-full accent-red-500"
                min={0.2}
                max={3}
                step={0.1}
                value={lineWidth()}
                onInput={(e) => setLineWidth(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums ml-1">
                {lineWidth().toFixed(1)}
              </span>
            </>
          )}

          {settingRow(
            "Segments",
            <div class="flex items-center gap-2 w-full">
              <input
                type="range"
                class="min-w-0 flex-1 accent-red-500"
                min={12}
                max={120}
                step={1}
                value={segments()}
                onInput={(e) => setSegments(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums shrink-0 w-8 text-right">
                {segments()}
              </span>
            </div>,
            "Smoothness of each curve (higher = smoother, heavier)."
          )}

          {settingRow(
            "Initial angle (°)",
            <div class="flex items-center gap-2 w-full">
              <input
                type="range"
                class="min-w-0 flex-1 accent-red-500"
                min={0}
                max={360}
                step={1}
                value={initialAngle()}
                onInput={(e) => setInitialAngle(+e.currentTarget.value)}
              />
              <span class="text-neutral-500 text-xs tabular-nums shrink-0 w-10 text-right">
                {initialAngle()}°
              </span>
            </div>,
            "Starting rotation; updates live."
          )}

          {settingRow(
            "Auto rotate",
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                class="rounded border-neutral-600"
                checked={autoRotate()}
                onChange={(e) => setAutoRotate(e.currentTarget.checked)}
              />
              <span class="text-neutral-300">Animate</span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};

export default WireframeGlobePlayground;
