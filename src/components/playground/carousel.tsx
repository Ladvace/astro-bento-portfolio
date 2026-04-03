import { createSignal, createEffect, onMount, onCleanup, For } from "solid-js";

interface CarouselItem {
  title: string;
  imgSrc: string;
}

const Carousel = () => {
  const [progress, setProgress] = createSignal<number>(50);
  const [active, setActive] = createSignal<number>(0);
  const [isDown, setIsDown] = createSignal<boolean>(false);
  const [startX, setStartX] = createSignal<number>(0);

  const speedWheel: number = 0.02;
  const speedDrag: number = -0.1;

  const carouselItems: CarouselItem[] = [
    {
      title: "Darius",
      imgSrc: "/darius.webp",
    },
    {
      title: "Aatrox",
      imgSrc: "/aatrox.webp",
    },
    {
      title: "Akali",
      imgSrc: "/akali.webp",
    },
    {
      title: "Alistar",
      imgSrc: "/alistar.webp",
    },
    {
      title: "Garen",
      imgSrc: "/garen.webp",
    },
    {
      title: "Hecarim",
      imgSrc: "/hecarim.webp",
    },
  ];

  const getZindex = (array: CarouselItem[], index: number): number[] =>
    array.map((_, i) =>
      index === i ? array.length : array.length - Math.abs(index - i)
    );

  const animate = (): void => {
    setProgress(Math.max(0, Math.min(progress(), 100)));
    setActive(Math.floor((progress() / 100) * (carouselItems.length - 1)));
  };

  createEffect(animate);

  const handleWheel = (e: WheelEvent): void => {
    const wheelProgress = e.deltaY * speedWheel;
    setProgress(progress() + wheelProgress);
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent): void => {
    if (e.type === "mousemove") {
      document.querySelectorAll(".cursor").forEach(($cursor) => {
        if ($cursor instanceof HTMLElement) {
          $cursor.style.transform = `translate(${
            (e as MouseEvent).clientX
          }px, ${(e as MouseEvent).clientY}px)`;
        }
      });
    }
    if (!isDown()) return;
    const x = "clientX" in e ? e.clientX : e.touches ? e.touches[0].clientX : 0;
    const mouseProgress = (x - startX()) * speedDrag;
    setProgress(progress() + mouseProgress);
    setStartX(x);
  };

  const handleMouseDown = (e: MouseEvent | TouchEvent): void => {
    setIsDown(true);
    setStartX(
      "clientX" in e ? e.clientX : e.touches ? e.touches[0].clientX : 0
    );
  };

  const handleMouseUp = (): void => {
    setIsDown(false);
  };

  onMount(() => {
    document.addEventListener("wheel", handleWheel);
    document.addEventListener("mousedown", handleMouseDown as EventListener);
    document.addEventListener("mousemove", handleMouseMove as EventListener);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchstart", handleMouseDown as EventListener);
    document.addEventListener("touchmove", handleMouseMove as EventListener);
    document.addEventListener("touchend", handleMouseUp);
  });

  onCleanup(() => {
    //   document.removeEventListener("wheel", handleWheel);
    //   document.removeEventListener(
    //     "mousedown",
    //     handleMouseDown as EventListener
    //   );
    // document.removeEventListener("mousemove", handleMouseMove as EventListener);
    //   document.removeEventListener("mouseup", handleMouseUp);
    //   document.removeEventListener(
    //     "touchstart",
    //     handleMouseDown as EventListener
    //   );
    // document.removeEventListener("touchmove", handleMouseMove as EventListener);
    //   document.removeEventListener("touchend", handleMouseUp);
  });

  return (
    <div class="relative z-10 h-full w-full overflow-hidden pointer-events-none">
      <For each={carouselItems}>
        {(item, index) => (
          <div
            class="cursor-pointer carousel-item absolute overflow-hidden rounded-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 user-select-none origin-bottom-left shadow-lg bg-black pointer-events-auto transition-transform duration-800 ease-[cubic-bezier(0,0.02,0,1)]"
            style={{
              "--items": carouselItems.length.toString(),
              "--height": "400px",
              "--width": "300px",
              width: "var(--width)",
              height: "var(--height)",
              "--zIndex": getZindex(carouselItems, active())[
                index()
              ].toString(),
              "--active": (
                (index() - active()) /
                carouselItems.length
              ).toString(),
              "z-index": "var(--zIndex)",
              transform:
                "translate(calc(var(--active) * 300%), calc(var(--active) * 100%)) rotate(calc(var(--active) * 120deg))",
              margin: "calc(var(--height)* -0.5) 0 0 calc(var(--width)* -0.5)",
            }}
            onClick={() =>
              setProgress((index() / carouselItems.length) * 100 + 10)
            }
          >
            <div
              class="carousel-box absolute inset-0 z-10 transition-opacity duration-800 ease-[cubic-bezier(0,0.02,0,1)]"
              style={{
                opacity: "calc(var(--zIndex) / var(--items) * 3 - 2)",
              }}
            >
              <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50"></div>
              <div class="title absolute z-10 text-white bottom-5 left-5 text-[clamp(20px,3vw,30px)] transition-opacity duration-800 ease-[cubic-bezier(0,0.02,0,1)] shadow-sm">
                {item.title}
              </div>
              <img
                src={item.imgSrc}
                alt={item.title}
                class="w-full h-full object-cover pointer-events-none"
              />
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

export default Carousel;
