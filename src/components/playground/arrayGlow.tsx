import { onCleanup, onMount } from "solid-js";

const getIndicesForHello = (): number[] => {
  const letterH = [0, 25, 50, 75, 100, 125, 76, 77, 3, 28, 53, 78, 103, 128];

  const letterE = [5, 30, 55, 80, 105, 130, 6, 7, 8, 81, 82, 83, 131, 132, 133];

  const firstL = [10, 35, 60, 85, 110, 135, 136, 137, 138];
  const secondL = [15, 40, 65, 90, 115, 140, 141, 142, 143];

  const letterO = [
    20, 45, 90, 70, 95, 120, 145, 146, 147, 148, 149, 21, 22, 23, 24, 49, 74,
    99, 124,
  ];

  return [...letterH, ...letterE, ...firstL, ...secondL, ...letterO];
};

const rows = 6;
const columns = 25;
const transitionDuration = 250;
const indices = getIndicesForHello();

const states = ["medium", "high"];

const getRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const ArrayGlow = () => {
  let ref: HTMLDivElement;

  onMount(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    const interval = setInterval(() => {
      indices.forEach((index) => {
        const light = ref.querySelector<HTMLDivElement>(
          `[data-index="${index}"]`
        );

        if (!light) {
          return;
        }

        const nextState = states[Math.floor(Math.random() * states.length)];
        const currentState = light.dataset.state;

        const pulse =
          Math.random() > 0.2 &&
          ((currentState === "off" && nextState === "high") ||
            (currentState === "off" && nextState === "medium") ||
            (currentState === "medium" && nextState === "high"));

        if (pulse) {
          const delay = getRandomNumber(100, 500);

          timeoutIds.push(
            setTimeout(() => {
              light.style.transform = "scale(2)";
            }, delay)
          );

          timeoutIds.push(
            setTimeout(() => {
              light.style.transform = "scale(1)";
            }, transitionDuration + delay)
          );
        }

        if (currentState === "high" && nextState === "medium" && pulse) {
          light.dataset.state = "off";
        } else {
          light.dataset.state = nextState;
        }
      });
    }, 1000);

    onCleanup(() => {
      clearInterval(interval);
      timeoutIds.forEach(clearTimeout);
    });
  });

  return (
    <div
      ref={(el) => (ref = el!)}
      class="switchboard"
      style={{
        display: "grid",
        gap: `${columns}px`,
        "grid-template-columns": `repeat(${columns}, 1fr)`,
      }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <div
          class="star"
          data-state="off"
          data-index={i}
          style={{
            "--transition-duration": `${transitionDuration}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default ArrayGlow;
