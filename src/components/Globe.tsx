import { onMount } from "solid-js";
import * as d3 from "d3";
import worldData from "../lib/world.json";
import { SITE } from "../site-config";

type Props = {
  isStatic?: boolean;
  class?: string;
  enableHover?: boolean;
};

// --- Tunables -------------------------------------------------------
const PROJECTION_SCALE = 320;
const FALLBACK_HEIGHT = 500;
const DRAG_SENSITIVITY = 75;
const TICK_MS = 200;

const WAVE_SCALE = 0.3;
const ORIENT_EPS_DEG = 0.5;

const TROPIC_LAT = 23.5;

const RING_OFFSET = 6;
const RING_TICK_LENGTH = 5;
const NUMERAL_OFFSET = 12;
const CARDINAL_OFFSET = 16;

// --- Colors ---------------------------------------------------------
const SPHERE_FILL = "#0d1b2a";
const SPHERE_STIPPLE = "#152838";
const SPHERE_STROKE = "#1e3a52";
const COUNTRY_FILL = "#1a2e42";
const COUNTRY_HOVER_FILL = "#2a4a63";
const COUNTRY_STROKE = "#2a4a63";
const GRATICULE_STROKE = "#1a2e42";
const TROPIC_STROKE = "#1f3a52";
const EQUATOR_STROKE = "#2a4a63";
const RING_STROKE = "#2a4a63";
const WAVE_FILL = "#2a4a63";
const TOOLTIP_BG = "#0e0e0e";
const TOOLTIP_INK = "#ffffff";
const TOOLTIP_BORDER = "#383838";

// --- Wave glyphs (hand-drawn ink shapes) ----------------------------
const WAVE_PATHS = [
  "M33.3027 30.9707C33.3193 32.4084 33.5211 34.0142 33.9785 35.4297C34.4408 36.8602 35.1269 37.9843 36.0312 38.6163C36.8828 39.2112 38.0745 39.472 39.831 38.8877C41.6303 38.2892 43.9716 36.8136 46.9482 33.9747L48.8193 32.1895L48.6357 34.7696C48.4879 36.8392 49.0888 39.3843 51.082 40.75C53.0554 42.1021 56.8153 42.5854 63.6709 39.5538C64.1759 39.3306 64.7669 39.5595 64.9902 40.0645C65.2133 40.5695 64.9844 41.1595 64.4795 41.3829C57.4161 44.5064 52.7968 44.3493 49.9512 42.3995C47.9284 41.0133 47.019 38.8676 46.7275 36.8731C44.3409 38.9278 42.2691 40.185 40.4619 40.7862C38.2199 41.5318 36.3465 41.2765 34.8857 40.2559C33.478 39.2723 32.604 37.6811 32.0752 36.045C31.927 35.5865 31.8053 35.1148 31.7031 34.6397C31.576 34.8096 31.4451 34.9783 31.3086 35.1436C30.282 36.3867 28.9494 37.5724 27.5332 38.6465C24.7008 40.7947 21.4201 42.5827 19.2539 43.5791C18.7522 43.8099 18.1586 43.5905 17.9277 43.0889C17.6969 42.5872 17.9163 41.9936 18.418 41.7627C20.4866 40.8112 23.6344 39.0928 26.3242 37.0528C27.6691 36.0327 28.8717 34.9526 29.7656 33.8702C30.6685 32.7768 33.1847 28.4432 33.3027 27.5389V30.9707Z",
  "M56.1631 100.187C57.5687 102.828 60.226 106.185 63.5801 107.811C65.2356 108.614 67.0418 108.987 68.9639 108.673C70.8884 108.36 73.0176 107.342 75.291 105.213L76.7031 103.891L76.9658 105.807C77.1045 106.817 77.8057 108.385 79.543 109.53C81.2668 110.666 84.1155 111.452 88.6494 110.696L88.9775 112.669C84.0871 113.484 80.6925 112.684 78.4414 111.2C76.926 110.201 75.9772 108.92 75.4551 107.714C73.3637 109.388 71.2962 110.32 69.2861 110.648C66.8897 111.039 64.6667 110.561 62.707 109.611C59.951 108.274 57.682 105.987 56.0547 103.755C55.5587 106.335 54.3485 108.632 52.9346 110.535C50.9693 113.179 48.5537 115.143 46.8965 116.16L45.8516 114.455C47.3134 113.558 49.5309 111.761 51.3291 109.341C53.1261 106.923 55.1768 100.622 55.0122 97.3662L56.1631 100.187Z",
  "M11.3125 3.59277C10.9062 6.37842 11.5531 9.51137 14.2305 10.8516C15.6064 11.5401 17.6599 11.8484 20.6748 11.2842C23.6902 10.7198 27.6001 9.29419 32.6143 6.60547L33.5596 8.36816C28.44 11.1134 24.3297 12.6348 21.043 13.25C17.7563 13.8651 15.2245 13.5857 13.3359 12.6406C10.6428 11.2928 9.53884 8.77468 9.27246 6.32617L1.55273 15.8281L0 14.5664L11.8369 0L11.3125 3.59277Z",
  "M22.5557 64.3859C22.8649 66.8629 24.3791 70.3394 27.9297 72.5939C31.4599 74.8352 37.178 75.9762 46.1064 73.4493L46.6514 75.3741C37.3606 78.0036 31.011 76.9187 26.8584 74.2823C24.5592 72.8225 22.9877 70.9195 21.9814 69.007C21.0821 72.7658 19.2545 75.3249 17.084 76.9865C14.1849 79.2057 10.7946 79.7337 8.52344 79.5363L8.69727 77.5441C10.5635 77.7062 13.4334 77.2623 15.8682 75.3986C18.2624 73.5657 21.7741 66.9023 21.9814 61.1094L22.5557 64.3859Z",
];

// --- Helpers --------------------------------------------------------
const DEG = Math.PI / 180;

const toCart = (lon: number, lat: number): [number, number, number] => {
  const lonR = lon * DEG;
  const latR = lat * DEG;
  const cl = Math.cos(latR);
  return [Math.cos(lonR) * cl, Math.sin(lonR) * cl, Math.sin(latR)];
};

const seededRng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const sampleLatLine = (lat: number): [number, number][] =>
  Array.from({ length: 181 }, (_, i) => [i * 2 - 180, lat]);

const EQUATOR_GEOMETRY = {
  type: "LineString" as const,
  coordinates: sampleLatLine(0),
};

const TROPICS_GEOMETRY = {
  type: "GeometryCollection" as const,
  geometries: [
    { type: "LineString" as const, coordinates: sampleLatLine(TROPIC_LAT) },
    { type: "LineString" as const, coordinates: sampleLatLine(-TROPIC_LAT) },
  ],
};

const forEachCoord = (
  coords: any,
  fn: (point: [number, number]) => void,
): void => {
  if (typeof coords[0] === "number") {
    fn(coords as [number, number]);
  } else {
    for (const sub of coords) forEachCoord(sub, fn);
  }
};

const GlobeComponent = ({ isStatic, enableHover }: Props) => {
  let mapContainer: HTMLDivElement | undefined;
  const visitedCountries = SITE.visitedCountries;
  const features = worldData.features as any[];

  onMount(() => {
    if (!mapContainer) return;

    // --- sizing & projection -----------------------------------------
    // The interactive globe gets an ornamental ring → enforce minimum
    // canvas size so the rings + ticks aren't clipped.
    const ringOuter = PROJECTION_SCALE + RING_OFFSET;
    const ringOutermost = ringOuter + RING_TICK_LENGTH;
    const numeralRadius = ringOutermost + NUMERAL_OFFSET;
    const cardinalRadius = numeralRadius + CARDINAL_OFFSET;
    const minDim = enableHover ? (cardinalRadius + 8) * 2 + 8 : 0;
    const width = Math.max(mapContainer.clientWidth, minDim);
    const height = Math.max(
      mapContainer.clientHeight || FALLBACK_HEIGHT,
      minDim,
    );
    const cx = width / 2;
    const cy = height / 2;

    const projection = d3
      .geoOrthographic()
      .scale(PROJECTION_SCALE)
      .center([0, 0])
      .rotate([0, -30])
      .translate([cx, cy]);
    const pathGenerator = d3.geoPath().projection(projection);

    const svg = d3
      .select(mapContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // --- defs: Taiwan stripe pattern + ocean stipple -----------------
    const defs = svg.append("defs");

    const taiwanPattern = defs
      .append("pattern")
      .attr("id", "taiwan-stripes")
      .attr("width", 3)
      .attr("height", 3)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");
    taiwanPattern
      .append("rect")
      .attr("width", 3)
      .attr("height", 3)
      .attr("fill", COUNTRY_FILL);
    taiwanPattern
      .append("rect")
      .attr("width", 1.5)
      .attr("height", 3)
      .attr("fill", "var(--primary-500)")
      .attr("opacity", "0.5");

    const stipple = defs
      .append("pattern")
      .attr("id", "ocean-stipple")
      .attr("width", 6)
      .attr("height", 6)
      .attr("patternUnits", "userSpaceOnUse");
    stipple
      .append("rect")
      .attr("width", 6)
      .attr("height", 6)
      .attr("fill", SPHERE_FILL);
    stipple
      .append("circle")
      .attr("cx", 1.5)
      .attr("cy", 1.5)
      .attr("r", 0.5)
      .attr("fill", SPHERE_STIPPLE);
    stipple
      .append("circle")
      .attr("cx", 4.5)
      .attr("cy", 4.5)
      .attr("r", 0.5)
      .attr("fill", SPHERE_STIPPLE);

    // --- ornamental compass-bezel ring (interactive globe only) ------
    if (enableHover) {
      const ringGroup = svg.append("g").attr("class", "ornamental-ring");
      ringGroup
        .append("circle")
        .attr("fill", "none")
        .attr("stroke", RING_STROKE)
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.8)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", ringOuter);
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = deg * DEG;
        const isMajor = deg % 30 === 0;
        const isCardinal = deg % 90 === 0;
        ringGroup
          .append("line")
          .attr("x1", cx + Math.cos(rad) * ringOuter)
          .attr("y1", cy + Math.sin(rad) * ringOuter)
          .attr("x2", cx + Math.cos(rad) * ringOutermost)
          .attr("y2", cy + Math.sin(rad) * ringOutermost)
          .style("stroke", RING_STROKE)
          .style("stroke-width", isCardinal ? 1.0 : isMajor ? 0.8 : 0.4)
          .style("opacity", isCardinal ? 0.9 : 0.7);
      }
      ringGroup
        .append("circle")
        .attr("fill", "none")
        .attr("stroke", RING_STROKE)
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.8)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", ringOutermost);
      // Degree numerals (every 30°), rotated to point radially outward.
      // Compass convention: 0° at top (north), increasing clockwise.
      for (let d = 0; d < 360; d += 30) {
        const screenAngle = (d - 90) * DEG;
        const nx = cx + Math.cos(screenAngle) * numeralRadius;
        const ny = cy + Math.sin(screenAngle) * numeralRadius;
        ringGroup
          .append("text")
          .text(String(d))
          .attr("x", nx)
          .attr("y", ny)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("transform", `rotate(${d}, ${nx}, ${ny})`)
          .style("fill", RING_STROKE)
          .style("font-family", '"Georgia", "Times New Roman", serif')
          .style("font-size", "8.5px")
          .style("font-weight", "500")
          .style("letter-spacing", "0.3px")
          .style("opacity", 0.85);
      }
      // Cardinal letters (N/E/S/W) further out, bolder, always upright.
      const cardinals: { d: number; letter: string }[] = [
        { d: 0, letter: "N" },
        { d: 90, letter: "E" },
        { d: 180, letter: "S" },
        { d: 270, letter: "W" },
      ];
      for (const { d, letter } of cardinals) {
        const screenAngle = (d - 90) * DEG;
        const lx = cx + Math.cos(screenAngle) * cardinalRadius;
        const ly = cy + Math.sin(screenAngle) * cardinalRadius;
        ringGroup
          .append("text")
          .text(letter)
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .style("fill", RING_STROKE)
          .style("font-family", '"Georgia", "Times New Roman", serif')
          .style("font-size", "14px")
          .style("font-weight", "700")
          .style("opacity", 1);
      }
    }

    // --- sphere (filled with stipple pattern) ------------------------
    svg
      .append("circle")
      .attr("fill", "url(#ocean-stipple)")
      .attr("stroke", SPHERE_STROKE)
      .attr("stroke-width", 0.3)
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", PROJECTION_SCALE);

    const map = svg.append("g");

    // --- graticule + tropics + equator -------------------------------
    const graticulePath = map
      .append("g")
      .attr("class", "graticule")
      .append("path")
      .datum(d3.geoGraticule().step([20, 20])())
      .attr("d", pathGenerator as any)
      .style("fill", "none")
      .style("stroke", GRATICULE_STROKE)
      .style("stroke-width", 0.5)
      .style("opacity", 0.5);

    const tropicsPath = map
      .append("g")
      .attr("class", "tropics")
      .append("path")
      .datum(TROPICS_GEOMETRY as any)
      .attr("d", pathGenerator as any)
      .style("fill", "none")
      .style("stroke", TROPIC_STROKE)
      .style("stroke-width", 0.5)
      .style("opacity", 0.65);

    const equatorPath = map
      .append("g")
      .attr("class", "equator")
      .append("path")
      .datum(EQUATOR_GEOMETRY as any)
      .attr("d", pathGenerator as any)
      .style("fill", "none")
      .style("stroke", EQUATOR_STROKE)
      .style("stroke-width", 0.6)
      .style("opacity", 0.75);

    // --- waves: pre-compute glyph bbox centers -----------------------
    const waveVariants = WAVE_PATHS.map((d) => {
      const tmp = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      tmp.setAttribute("d", d);
      svg.node()!.appendChild(tmp);
      const bb = tmp.getBBox();
      tmp.remove();
      return { d, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
    });

    // --- waves: seeded ocean placements ------------------------------
    const waveCount = enableHover ? 80 : 20;
    const minWaveDist = (enableHover ? 9 : 18) * DEG;
    const coastlineBuffer = 2;

    const waves = (() => {
      const rng = seededRng(42);
      const oceanOffsets: [number, number][] = [
        [0, 0],
        [coastlineBuffer, 0],
        [-coastlineBuffer, 0],
        [0, coastlineBuffer],
        [0, -coastlineBuffer],
      ];
      const isOcean = (lon: number, lat: number): boolean => {
        for (const [dlon, dlat] of oceanOffsets) {
          const tLat = Math.max(-89, Math.min(89, lat + dlat));
          for (const f of features) {
            if (d3.geoContains(f, [lon + dlon, tLat])) return false;
          }
        }
        return true;
      };
      const out: { lon: number; lat: number; variant: number }[] = [];
      let attempts = 0;
      while (out.length < waveCount && attempts < waveCount * 100) {
        attempts++;
        const lon = rng() * 360 - 180;
        const lat = (Math.asin(rng() * 2 - 1) * 180) / Math.PI;
        if (!isOcean(lon, lat)) continue;
        let tooClose = false;
        for (const w of out) {
          if (d3.geoDistance([lon, lat], [w.lon, w.lat]) < minWaveDist) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
        out.push({
          lon,
          lat,
          variant: Math.floor(rng() * waveVariants.length),
        });
      }
      return out;
    })();

    const waveElements = map
      .append("g")
      .attr("class", "waves")
      .selectAll("path")
      .data(waves)
      .enter()
      .append("path")
      .attr("d", (d) => waveVariants[d.variant].d)
      .style("fill", WAVE_FILL)
      .style("stroke", "none")
      .style("opacity", 0.7);

    const orientFactor =
      WAVE_SCALE / (ORIENT_EPS_DEG * DEG) / projection.scale();

    const updateWaves = () => {
      const rot = projection.rotate();
      const viewCenter: [number, number] = [-rot[0], -rot[1]];
      const halfPi = Math.PI / 2;
      waveElements.each(function (d) {
        const el = this as SVGPathElement;
        if (d3.geoDistance([d.lon, d.lat], viewCenter) > halfPi) {
          el.style.display = "none";
          return;
        }
        const p0 = projection([d.lon, d.lat]);
        const pE = projection([d.lon + ORIENT_EPS_DEG, d.lat]);
        const pS = projection([
          d.lon,
          Math.max(-89, d.lat - ORIENT_EPS_DEG),
        ]);
        if (!p0 || !pE || !pS) {
          el.style.display = "none";
          return;
        }
        const a = (pE[0] - p0[0]) * orientFactor;
        const b = (pE[1] - p0[1]) * orientFactor;
        const c = (pS[0] - p0[0]) * orientFactor;
        const dd = (pS[1] - p0[1]) * orientFactor;
        const v = waveVariants[d.variant];
        const e = p0[0] - a * v.cx - c * v.cy;
        const f = p0[1] - b * v.cx - dd * v.cy;
        el.style.display = "";
        el.setAttribute("transform", `matrix(${a} ${b} ${c} ${dd} ${e} ${f})`);
      });
    };
    updateWaves();

    // --- countries: pre-compute centroid + max radius for culling ---
    const featureCull = features.map((f) => {
      const centroid = d3.geoCentroid(f);
      let maxRadius = 0;
      forEachCoord(f.geometry.coordinates, (p) => {
        const r = d3.geoDistance(centroid, p);
        if (r > maxRadius) maxRadius = r;
      });
      return {
        cart: toCart(centroid[0], centroid[1]),
        // Feature is fully on the back when centroid > 90° + maxRadius
        // behind view; cos(that) = -sin(maxRadius).
        cullDot: -Math.sin(maxRadius),
      };
    });

    const fillForCountry = (name: string): string => {
      if (name === "Taiwan") return "url(#taiwan-stripes)";
      return visitedCountries.includes(name)
        ? "var(--primary-500)"
        : COUNTRY_FILL;
    };

    const paths = map
      .append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(features)
      .enter()
      .append("path")
      .attr("d", pathGenerator as any)
      .style("fill", (d: any) => fillForCountry(d.properties.name))
      .style("stroke", COUNTRY_STROKE)
      .style("stroke-width", 0.3)
      .style("opacity", 0.8);


    // --- hover (cartouche-style tooltip) -----------------------------
    let isPaused = false;
    let dragStart: [number, number] | null = null;

    if (enableHover) {
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "globe-tooltip")
        .style("position", "absolute")
        .style("background", TOOLTIP_BG)
        .style("color", TOOLTIP_INK)
        .style("padding", "6px 12px")
        .style("border", `1px solid ${TOOLTIP_BORDER}`)
        .style("border-radius", "8px")
        .style("font-family", "var(--font-satoshi), sans-serif")
        .style("font-weight", "500")
        .style("font-size", "13px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000)
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.4)");

      const moveTooltip = (event: MouseEvent) =>
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 12}px`);

      paths
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          const name = d.properties.name;
          const isVisited = visitedCountries.includes(name);
          const el = d3.select(this);
          if (!isVisited && name !== "Taiwan") {
            el.style("fill", COUNTRY_HOVER_FILL);
          }
          el.style("opacity", 1).style("stroke-width", 0.5);
          tooltip.html(name).style("opacity", 1);
          moveTooltip(event);
        })
        .on("mousemove", function (event) {
          moveTooltip(event);
        })
        .on("mouseout", function (_event, d: any) {
          const name = d.properties.name;
          d3.select(this)
            .style("fill", fillForCountry(name))
            .style("opacity", 0.8)
            .style("stroke-width", 0.3);
          tooltip.style("opacity", 0);
        });
    }

    // --- per-frame update --------------------------------------------
    const updatePaths = () => {
      const rot = projection.rotate();
      const [vx, vy, vz] = toCart(-rot[0], -rot[1]);
      paths.attr("d", function (d: any, i: number) {
        const fc = featureCull[i];
        if (fc.cart[0] * vx + fc.cart[1] * vy + fc.cart[2] * vz < fc.cullDot) {
          return "";
        }
        return pathGenerator(d);
      });
      graticulePath.attr("d", pathGenerator as any);
      tropicsPath.attr("d", pathGenerator as any);
      equatorPath.attr("d", pathGenerator as any);
      updateWaves();
    };

    // --- drag --------------------------------------------------------
    if (enableHover) {
      svg
        .on("mouseenter", () => {
          isPaused = true;
        })
        .on("mouseleave", () => {
          isPaused = false;
        })
        .call(
          d3
            .drag<SVGSVGElement, unknown>()
            .on("start", (event) => {
              isPaused = true;
              dragStart = [event.x, event.y];
            })
            .on("drag", (event) => {
              if (!dragStart) return;
              const rot = projection.rotate();
              const k = DRAG_SENSITIVITY / projection.scale();
              const dx = event.x - dragStart[0];
              const dy = event.y - dragStart[1];
              projection.rotate([
                rot[0] + dx * k,
                Math.max(-90, Math.min(90, rot[1] - dy * k)),
              ]);
              dragStart = [event.x, event.y];
              updatePaths();
            })
            .on("end", () => {
              dragStart = null;
            }),
        );
    }

    // --- auto-rotate -------------------------------------------------
    d3.timer(() => {
      if (isPaused || isStatic) return;
      const rot = projection.rotate();
      const k = DRAG_SENSITIVITY / projection.scale();
      projection.rotate([rot[0] - k, rot[1]]);
      updatePaths();
    }, TICK_MS);
  });

  return (
    <div class="flex flex-col text-white justify-center items-center w-full h-full">
      <div
        class="w-full h-full flex justify-center items-center"
        ref={mapContainer}
      ></div>
      {enableHover && (
        <p class="text-sm text-darkslate-300 mt-4 text-center">
          Click and drag to rotate
        </p>
      )}
    </div>
  );
};

export default GlobeComponent;
