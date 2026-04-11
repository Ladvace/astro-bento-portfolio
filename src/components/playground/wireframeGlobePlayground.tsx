import { createSignal, type Component, type JSX } from "solid-js";
import WireframeGlobe from "./wireframeGlobe";

const GLOBE_SIZE_PX = 420;

const DEFAULTS = {
  latLines: 10,
  lonLines: 20,
  tiltDeg: 20,
  speed: 1,
  color: "#a3a3a3",
  frontOpacity: 0.85,
  backOpacity: 0.15,
  lineWidth: 0.8,
  segments: 60,
  autoRotate: true,
  initialAngle: 0,
} as const;

function sectionTitle(text: string) {
  return (
    <h3 class="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-neutral-500 mb-3">
      {text}
    </h3>
  );
}

function SliderField(props: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = props.format ?? ((v: number) => String(v));
  return (
    <div class="group flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div class="sm:w-[7.5rem] shrink-0">
        <label class="text-neutral-200 text-sm font-medium leading-snug">
          {props.label}
        </label>
        {props.hint ? (
          <p class="text-neutral-500 text-xs mt-0.5 leading-relaxed max-w-[14rem]">
            {props.hint}
          </p>
        ) : null}
      </div>
      <div class="flex flex-1 items-center gap-3 min-w-0">
        <input
          type="range"
          class="slider-wireframe h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onInput={(e) => props.onInput(+e.currentTarget.value)}
        />
        <output
          class="tabular-nums text-xs font-medium text-neutral-300 bg-neutral-800/90 border border-neutral-600/80 rounded-md px-2.5 py-1 min-w-[3.25rem] text-center shrink-0"
          aria-live="polite"
        >
          {fmt(props.value)}
        </output>
      </div>
    </div>
  );
}

function settingBlock(label: string, control: JSX.Element, hint?: string) {
  return (
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div class="sm:w-[7.5rem] shrink-0 pt-0.5">
        <label class="text-neutral-200 text-sm font-medium leading-snug">
          {label}
        </label>
        {hint ? (
          <p class="text-neutral-500 text-xs mt-0.5 leading-relaxed max-w-[14rem]">
            {hint}
          </p>
        ) : null}
      </div>
      <div class="min-w-0 flex-1">{control}</div>
    </div>
  );
}

const WireframeGlobePlayground: Component = () => {
  const [latLines, setLatLines] = createSignal(DEFAULTS.latLines);
  const [lonLines, setLonLines] = createSignal(DEFAULTS.lonLines);
  const [tiltDeg, setTiltDeg] = createSignal(DEFAULTS.tiltDeg);
  const [speed, setSpeed] = createSignal(DEFAULTS.speed);
  const [color, setColor] = createSignal<string>(DEFAULTS.color);
  const [frontOpacity, setFrontOpacity] = createSignal(DEFAULTS.frontOpacity);
  const [backOpacity, setBackOpacity] = createSignal(DEFAULTS.backOpacity);
  const [lineWidth, setLineWidth] = createSignal(DEFAULTS.lineWidth);
  const [segments, setSegments] = createSignal(DEFAULTS.segments);
  const [autoRotate, setAutoRotate] = createSignal<boolean>(
    DEFAULTS.autoRotate,
  );
  const [initialAngle, setInitialAngle] = createSignal(DEFAULTS.initialAngle);

  const reset = () => {
    setLatLines(DEFAULTS.latLines);
    setLonLines(DEFAULTS.lonLines);
    setTiltDeg(DEFAULTS.tiltDeg);
    setSpeed(DEFAULTS.speed);
    setColor(DEFAULTS.color);
    setFrontOpacity(DEFAULTS.frontOpacity);
    setBackOpacity(DEFAULTS.backOpacity);
    setLineWidth(DEFAULTS.lineWidth);
    setSegments(DEFAULTS.segments);
    setAutoRotate(DEFAULTS.autoRotate);
    setInitialAngle(DEFAULTS.initialAngle);
  };

  const tiltRad = () => (tiltDeg() * Math.PI) / 180;

  return (
    <div class="flex flex-col xl:flex-row gap-10 xl:gap-14 items-start justify-center w-full max-w-6xl mx-auto">
      <div class="flex-shrink-0 mx-auto xl:mx-0">
        <WireframeGlobe
          size={GLOBE_SIZE_PX}
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

      <aside class="w-full max-w-md rounded-2xl border border-neutral-600/60 bg-neutral-900/90 backdrop-blur-md shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04]">
        <div class="border-b border-neutral-700/60 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-white tracking-tight">
              Wireframe
            </h2>
            <p class="text-neutral-500 text-xs mt-0.5">
              Canvas projection · drag-free preview
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs font-medium text-red-400 hover:text-red-300 border border-neutral-600 hover:border-neutral-500 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            onClick={reset}
          >
            Reset
          </button>
        </div>

        <div class="p-5 space-y-8">
          <section>
            {sectionTitle("Geometry")}
            <div class="space-y-5">
              <SliderField
                label="Latitude lines"
                min={2}
                max={32}
                step={1}
                value={latLines()}
                onInput={setLatLines}
              />
              <SliderField
                label="Longitude lines"
                min={2}
                max={64}
                step={1}
                value={lonLines()}
                onInput={setLonLines}
              />
              <SliderField
                label="Segments"
                hint="Curve smoothness; higher is smoother but heavier."
                min={12}
                max={120}
                step={1}
                value={segments()}
                onInput={setSegments}
              />
              <SliderField
                label="Line width"
                min={0.2}
                max={3}
                step={0.1}
                value={lineWidth()}
                onInput={setLineWidth}
                format={(v) => `${v.toFixed(1)}px`}
              />
            </div>
          </section>

          <section class="border-t border-neutral-700/50 pt-8">
            {sectionTitle("Appearance")}
            <div class="space-y-5">
              {settingBlock(
                "Line color",
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    class="h-10 w-14 cursor-pointer rounded-lg border border-neutral-600 bg-neutral-800 p-1 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    value={color()}
                    onInput={(e) => setColor(e.currentTarget.value)}
                    aria-label="Pick line color"
                  />
                  <input
                    type="text"
                    class="flex-1 min-w-[6rem] rounded-lg border border-neutral-600 bg-neutral-800/80 px-3 py-2 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                    value={color()}
                    onInput={(e) => setColor(e.currentTarget.value)}
                    spellcheck={false}
                    autocapitalize="off"
                    autocomplete="off"
                  />
                </div>
              )}
              <SliderField
                label="Front opacity"
                min={0}
                max={1}
                step={0.05}
                value={frontOpacity()}
                onInput={setFrontOpacity}
                format={(v) => v.toFixed(2)}
              />
              <SliderField
                label="Back opacity"
                min={0}
                max={1}
                step={0.05}
                value={backOpacity()}
                onInput={setBackOpacity}
                format={(v) => v.toFixed(2)}
              />
            </div>
          </section>

          <section class="border-t border-neutral-700/50 pt-8">
            {sectionTitle("Motion")}
            <div class="space-y-5">
              <SliderField
                label="Tilt"
                hint="Rotation around X before projection."
                min={0}
                max={90}
                step={1}
                value={tiltDeg()}
                onInput={setTiltDeg}
                format={(v) => `${v}°`}
              />
              <SliderField
                label="Speed"
                hint="Auto-rotation multiplier."
                min={0}
                max={3}
                step={0.05}
                value={speed()}
                onInput={setSpeed}
                format={(v) => v.toFixed(2)}
              />
              <SliderField
                label="Initial angle"
                hint="Starting rotation; live while dragging."
                min={0}
                max={360}
                step={1}
                value={initialAngle()}
                onInput={setInitialAngle}
                format={(v) => `${v}°`}
              />
              {settingBlock(
                "Auto rotate",
                <label class="inline-flex items-center gap-3 cursor-pointer select-none rounded-lg border border-neutral-600/80 bg-neutral-800/50 px-3 py-2.5 w-full sm:w-auto hover:bg-neutral-800/80 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-red-500/50">
                  <input
                    type="checkbox"
                    class="size-4 rounded border-neutral-500 bg-neutral-800 text-red-500 focus:ring-red-500/50 focus:ring-offset-0 focus:ring-offset-neutral-900"
                    checked={autoRotate()}
                    onChange={(e) => setAutoRotate(e.currentTarget.checked)}
                  />
                  <span class="text-sm text-neutral-200">
                    Spin the globe continuously
                  </span>
                </label>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default WireframeGlobePlayground;
