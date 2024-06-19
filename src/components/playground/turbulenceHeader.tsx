import { createSignal, For } from "solid-js";

const turbulenceHeader = () => {
  const [selectedRouted, setSelectedRoute] = createSignal("Home");

  const routes = [
    {
      path: "/Home",
      label: "Home",
    },
    {
      path: "/about",
      label: "About",
    },
    {
      path: "/curriculum",
      label: "Curriculum",
    },
    {
      path: "/community",
      label: "Community",
    },
  ];

  let ref!: HTMLDivElement;

  return (
    <>
      <svg width="0" height="0">
        <filter id="turbulenceFilter">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.05"
            numOctaves="5"
            result="turbulence"
          />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="10" />
        </filter>
      </svg>
      <div class="flex justify-center items-center p-4 bg-darkslate-800 border-px border-darkslate-500 rounded-full">
        <div
          id="container"
          class="flex gap-4 text-white relative h-8"
          style={{
            "--width": "74px",
            "--height": "32px",
            "--x": "0px",
          }}
        >
          <div
            class="flex h-8 z-10"
            role="tablist"
            aria-orientation="horizontal"
          >
            <For each={routes}>
              {(route) => (
                <button
                  class="h-8 px-4 rounded-lg"
                  role="tab"
                  aria-selected={selectedRouted() === route.label}
                  onClick={(e) => {
                    const currentBtn = e.currentTarget.getBoundingClientRect();
                    const offsetLeft = e.currentTarget.offsetLeft;

                    ref.animate(
                      [
                        {
                          clipPath: `inset(0px calc(100% - (${offsetLeft}px + ${currentBtn.width}px)) calc(100% - (0px + var(--height))) ${offsetLeft}px round var(--height))`,
                          fontWeight: "bold",
                          color: "red",
                        },
                      ],
                      {
                        duration: 180,
                        fill: "forwards",
                      }
                    );
                    setSelectedRoute(route.label);
                  }}
                >
                  {route.label}
                </button>
              )}
            </For>
          </div>
          <div
            style={{
              "clip-path": `inset(0px calc(100% - (var(--x) + var(--width))) calc(100% - (0px + var(--height))) var(--x) round var(--height))`,
              "will-change": "clip-path",
              filter: "url(#turbulenceFilter)",
            }}
            ref={ref}
            class="absolute left-0 top-0 w-full h-8 bg-primary-500 pointer-events-none"
            role="tablist"
            aria-orientation="horizontal"
          >
            <For each={routes}>
              {(route) => (
                <button
                  class="h-8 px-4 rounded-lg"
                  role="tab"
                  aria-selected={selectedRouted() === route.label}
                ></button>
              )}
            </For>
          </div>
        </div>
      </div>
    </>
  );
};

export default turbulenceHeader;
