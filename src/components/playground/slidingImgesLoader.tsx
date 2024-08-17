import { createEffect } from "solid-js";
import {
  timeline,
  type AnimationControls,
  type TimelineDefinition,
} from "motion";

const images = [
  "https://images.pexels.com/photos/17860201/pexels-photo-17860201/free-photo-of-yellow-full-moon-in-the-evening-sky.jpeg?auto=compress&cs=tinysrgb&w=800&lazy=load",
  "https://images.pexels.com/photos/18091901/pexels-photo-18091901/free-photo-of-light-city-road-traffic.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
  "https://images.pexels.com/photos/17427379/pexels-photo-17427379/free-photo-of-a-pelican-by-a-sea.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
  "https://images.pexels.com/photos/18306269/pexels-photo-18306269.jpeg?auto=compress&cs=tinysrgb&w=800&lazy=load",
  "https://images.pexels.com/photos/17427379/pexels-photo-17427379/free-photo-of-a-pelican-by-a-sea.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
];

const getImagesForColumn = (props: {
  isMiddle?: boolean;
  isEdge?: boolean;
  isReversed?: boolean;
}) => {
  const columnImages = [...images];

  if (props.isReversed) {
    columnImages.reverse();
  }

  return columnImages;
};

export const Column = (props: {
  isMiddle?: boolean;
  isEdge?: boolean;
  isReversed?: boolean;
}) => {
  const columnImages = getImagesForColumn(props);
  return (
    <div
      id="column-container"
      class="flex flex-col even:justify-end justify-start items-stretch px-[7vh]"
    >
      <div
        id="inner-column-container"
        class="flex flex-col flex-none justify-between items-stretch w-screen h-full will-change-height will-change-transform"
        classList={{
          isCenter: props.isMiddle,
          isReversed: props.isReversed,
          isEdge: props.isEdge,
        }}
      >
        {columnImages.map((imageUrl, index) => (
          <div
            id="img-container"
            class={[
              index === 2 && props.isMiddle ? "isMiddle p-8" : "",
              "w-screen h-screen box-border relative overflow-hidden rounded-2xl",
            ].join(" ")}
          >
            <img
              alt={`Image ${index}`}
              width={300}
              height={100}
              class="w-full h-full min-w-full rounded-2xl object-cover will-change-transform"
              src={imageUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
const SlidingImgesLoader = () => {
  let customTimeline: AnimationControls;
  const loaderAnimation = [
    ["#overlay", { opacity: [1, 0] }, { easing: "ease-in-out", duration: 0.2 }],
    [
      "#global-loader",
      { opacity: [1, 0], pointerEvents: "none" },
      { easing: "ease-in-out", duration: 0.2 },
    ],
    [
      "#inner-column-container",
      { height: ["350%", "100%"] },
      { easing: "ease-in-out", duration: 2.5, at: "<" },
    ],
    [
      ".isReversed",
      { y: ["-40%", 0] },
      { easing: "ease-in-out", duration: 2.5, at: "<" },
    ],
    [
      ".isEdge",
      { y: ["70%", 0] },
      { easing: "ease-in-out", duration: 2.5, at: "<" },
    ],
    [
      ".isCenter",
      { y: ["40%", "0"] },
      { easing: "ease-in-out", duration: 2.5, at: "<" },
    ],
    [
      "#animation-container",
      { scale: ["0.23", "1"] },
      { easing: "ease-in-out", duration: 2, delay: 2, at: "<" },
    ],
    [
      ".isMiddle img",
      { scale: ["1.5", "1"] },
      { easing: "ease-in-out", duration: 2, delay: 2, at: "<" },
    ],
    [
      "#outer-animation-container",
      { opacity: [1, 0], pointerEvents: "none" },
      { easing: "ease-in-out" },
    ],
  ] as TimelineDefinition;

  createEffect(() => {
    customTimeline = timeline(loaderAnimation, { duration: 4 });
  });

  return (
    <div>
      <button
        onClick={() => {
          customTimeline.play();
        }}
        class="absolute right-4 top-4 text-white cursor-pointer bg-neutral-900 hover:bg-neutral-800 w-fit px-4 py-2 border-1 border-solid border-neutral-600 rounded-lg z-20 flex gap-2 items-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M12 5V2.21c0-.45-.54-.67-.85-.35l-3.8 3.79c-.2.2-.2.51 0 .71l3.79 3.79c.32.31.86.09.86-.36V7c3.73 0 6.68 3.42 5.86 7.29c-.47 2.27-2.31 4.1-4.57 4.57c-3.57.75-6.75-1.7-7.23-5.01a1 1 0 0 0-.98-.85c-.6 0-1.08.53-1 1.13c.62 4.39 4.8 7.64 9.53 6.72c3.12-.61 5.63-3.12 6.24-6.24C20.84 9.48 16.94 5 12 5"
          ></path>
        </svg>
        Replay
      </button>
      <div
        id="overlay"
        class="fixed inset-0 w-screen h-screen bg-neutral-800 z-[15]"
      />
      <div
        id="outer-animation-container"
        class="fixed inset-0 w-full h-screen overflow-hidden flex justify-center items-center bg-darkslate-900 z-10"
      >
        <div
          id="animation-container"
          class="scale-[0.1] flex justify-start items-stretch h-[561vh] will-change-transform"
        >
          <Column isEdge />
          <Column isReversed />
          <Column isMiddle />
          <Column isReversed />
          <Column isEdge />
        </div>
      </div>

      <div
        class={
          "w-screen h-screen box-border relative overflow-hidden rounded-2xl p-8 z-0"
        }
      >
        <img
          alt="img"
          class="w-full h-full min-w-full rounded-2xl object-cover"
          src={images[2]}
        />
      </div>
    </div>
  );
};

export default SlidingImgesLoader;
