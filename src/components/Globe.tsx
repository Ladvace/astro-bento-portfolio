import { onMount } from "solid-js";
import * as d3 from "d3";
import worldData from "../lib/world.json";
import { SITE } from "../site-config";

type Props = {
  isStatic?: boolean;
  class?: string;
  enableHover?: boolean;
};

const GlobeComponent = ({ isStatic, class: className, enableHover }: Props) => {
  let mapContainer: HTMLDivElement | undefined;

  const visitedCountries = SITE.visitedCountries;

  onMount(() => {
    if (!mapContainer) return;

    const width = mapContainer.clientWidth;
    const height = mapContainer.clientHeight || 500;
    const sensitivity = 75;

    let projection = d3
      .geoOrthographic()
      .scale(250)
      .center([0, 0])
      .rotate([0, -30])
      .translate([width / 2, height / 2]);

    const initialScale = projection.scale();
    let pathGenerator = d3.geoPath().projection(projection);

    let svg = d3
      .select(mapContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const defs = svg.append("defs");
    const pattern = defs
      .append("pattern")
      .attr("id", "taiwan-stripes")
      .attr("width", 3)
      .attr("height", 3)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");
    pattern
      .append("rect")
      .attr("width", 3)
      .attr("height", 3)
      .attr("fill", "#1a2e42");
    pattern
      .append("rect")
      .attr("width", 1.5)
      .attr("height", 3)
      .attr("fill", "var(--primary-500)")
      .attr("opacity", "0.5");

    svg
      .append("circle")
      .attr("fill", "#0d1b2a")
      .attr("stroke", "#1e3a52")
      .attr("stroke-width", "0.3")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", initialScale);

    let map = svg.append("g");

    const paths = map
      .append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(worldData.features)
      .enter()
      .append("path")
      .attr("d", (d: any) => pathGenerator(d as any))
      .style("fill", (d: { properties: { name: string } }) => {
        const name = d.properties.name;
        if (name === "Taiwan") return "url(#taiwan-stripes)";
        return visitedCountries.includes(name)
          ? "var(--primary-500)"
          : "#1a2e42";
      })
      .style("stroke", "#2a4a63")
      .style("stroke-width", 0.3)
      .style("opacity", 0.8);

    if (enableHover) {
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "globe-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "14px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);

      paths
        .style("cursor", "pointer")
        .on("mouseover", function (event, d: any) {
          const data = d as { properties: { name: string } };
          const isVisited = visitedCountries.includes(data.properties.name);
          const element = d3.select(this);

          if (!isVisited && data.properties.name !== "Taiwan") {
            element.style("fill", "#2a4a63");
          }
          element.style("opacity", 1).style("stroke-width", 0.5);

          tooltip
            .html(data.properties.name)
            .style("opacity", 1)
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
        })
        .on("mousemove", function (event) {
          tooltip
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
        })
        .on("mouseout", function (event, d: any) {
          const data = d as { properties: { name: string } };
          const isVisited = visitedCountries.includes(data.properties.name);
          const element = d3.select(this);

          if (data.properties.name === "Taiwan") {
            element.style("fill", "url(#taiwan-stripes)");
          } else if (!isVisited) {
            element.style("fill", "#1a2e42");
          }
          element.style("opacity", 0.8).style("stroke-width", 0.3);

          tooltip.style("opacity", 0);
        });
    }

    let isPaused = false;
    let previousMousePosition: [number, number] | null = null;

    const updatePaths = () => {
      svg.selectAll("path").attr("d", (d: any) => pathGenerator(d as any));
    };

    if (enableHover) {
      svg
        .on("mouseenter", function () {
          isPaused = true;
        })
        .on("mouseleave", function () {
          isPaused = false;
        })
        .call(
          d3
            .drag<SVGSVGElement, unknown>()
            .on("start", function (event) {
              isPaused = true;
              previousMousePosition = [event.x, event.y];
            })
            .on("drag", function (event) {
              if (previousMousePosition) {
                const rotate = projection.rotate();
                const dx = event.x - previousMousePosition[0];
                const dy = event.y - previousMousePosition[1];
                const k = sensitivity / projection.scale();
                projection.rotate([
                  rotate[0] + dx * k,
                  Math.max(-90, Math.min(90, rotate[1] - dy * k)),
                ]);
                previousMousePosition = [event.x, event.y];
                updatePaths();
              }
            })
            .on("end", function () {
              previousMousePosition = null;
            }),
        );
    }

    d3.timer(() => {
      if (!isPaused && !isStatic) {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);
        updatePaths();
      }
    }, 200);
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
