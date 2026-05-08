import {
  mergeProps,
  createEffect,
  createSignal,
  onCleanup,
  type Component,
} from "solid-js";

export interface WireframeGlobeProps {
  size?: number;
  latLines?: number;
  lonLines?: number;
  tilt?: number;
  speed?: number;
  color?: string;
  frontOpacity?: number;
  backOpacity?: number;
  lineWidth?: number;
  segments?: number;
  autoRotate?: boolean;
  initialAngle?: number;
}

const WireframeGlobe: Component<WireframeGlobeProps> = (props) => {
  const merged = mergeProps(
    {
      size: 300,
      latLines: 10,
      lonLines: 20,
      tilt: 0.35,
      speed: 1,
      color: "#3c3c3c",
      frontOpacity: 0.85,
      backOpacity: 0.15,
      lineWidth: 0.8,
      segments: 60,
      autoRotate: true,
      initialAngle: 0,
    },
    props,
  );

  const stateRef = {
    angle: (merged.initialAngle * Math.PI) / 180,
    animId: null as number | null,
  };

  createEffect(() => {
    stateRef.angle = (merged.initialAngle * Math.PI) / 180;
  });

  const parseColorToRGB = (cssColor: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "60,60,60";
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `${r},${g},${b}`;
  };

  const project = (
    lat: number,
    lon: number,
    rotAngle: number,
    cosT: number,
    sinT: number,
    radius: number,
    cx: number,
    cy: number,
  ) => {
    const phi = (lat * Math.PI) / 180;
    const theta = ((lon + rotAngle) * Math.PI) / 180;

    const x = Math.cos(phi) * Math.sin(theta);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(theta);

    const ty = y * cosT - z * sinT;
    const tz = y * sinT + z * cosT;

    return {
      sx: cx + x * radius,
      sy: cy - ty * radius,
      z: tz,
    };
  };

  const [canvasEl, setCanvasEl] = createSignal<HTMLCanvasElement>();

  createEffect(() => {
    const canvas = canvasEl();
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const size = merged.size;
    const color = merged.color;
    const speed = merged.speed;
    const autoRotate = merged.autoRotate;
    void merged.tilt;
    void merged.latLines;
    void merged.lonLines;
    void merged.segments;
    void merged.frontOpacity;
    void merged.backOpacity;
    void merged.lineWidth;

    const drawFrame = (
      c: CanvasRenderingContext2D,
      rotDeg: number,
      rgb: string,
      radius: number,
      cx: number,
      cy: number,
      logicalSize: number,
    ) => {
      const tilt = merged.tilt;
      const latLines = merged.latLines;
      const lonLines = merged.lonLines;
      const segments = merged.segments;
      const frontOpacity = merged.frontOpacity;
      const backOpacity = merged.backOpacity;
      const lineWidth = merged.lineWidth;

      c.clearRect(0, 0, logicalSize, logicalSize);

      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const drawSegment = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
      ) => {
        const p1 = project(lat1, lon1, rotDeg, cosT, sinT, radius, cx, cy);
        const p2 = project(lat2, lon2, rotDeg, cosT, sinT, radius, cx, cy);
        if (Math.abs(p2.sx - p1.sx) > radius * 0.8) return;
        const avgZ = (p1.z + p2.z) / 2;
        const alpha = avgZ > 0 ? frontOpacity : backOpacity;
        c.beginPath();
        c.moveTo(p1.sx, p1.sy);
        c.lineTo(p2.sx, p2.sy);
        c.strokeStyle = `rgba(${rgb},${alpha})`;
        c.lineWidth = lineWidth;
        c.stroke();
      };

      const latStep = 180 / latLines;
      const lonStep = 360 / lonLines;
      const segStep = 360 / segments;

      for (let i = 1; i < latLines; i++) {
        const lat = -90 + latStep * i;
        for (let s = 0; s < segments; s++) {
          const lon = segStep * s;
          drawSegment(lat, lon, lat, lon + segStep);
        }
      }

      for (let j = 0; j < lonLines; j++) {
        const lon = lonStep * j;
        const latSegStep = 180 / segments;
        for (let s = 0; s < segments; s++) {
          const lat = -90 + latSegStep * s;
          drawSegment(lat, lon, lat + latSegStep, lon);
        }
      }
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const radius = (size / 2) * 0.85;
    const cx = size / 2;
    const cy = size / 2;
    const rgb = parseColorToRGB(color);

    const state = stateRef;

    const tick = () => {
      if (autoRotate) {
        state.angle += speed * 0.008;
      }
      const rotDeg = (state.angle * 180) / Math.PI;
      drawFrame(ctx, rotDeg, rgb, radius, cx, cy, size);
      state.animId = requestAnimationFrame(tick);
    };

    state.animId = requestAnimationFrame(tick);

    onCleanup(() => {
      if (state.animId) cancelAnimationFrame(state.animId);
    });
  });

  return (
    <canvas
      ref={setCanvasEl}
      class="block"
      aria-label="Rotating wireframe globe"
    />
  );
};

export default WireframeGlobe;
