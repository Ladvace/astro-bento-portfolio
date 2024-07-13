<script lang="ts">
  import Shape1 from "./svg-shapes/Shape1.svelte";
  import Shape2 from "./svg-shapes/Shape2.svelte";
  import Shape3 from "./svg-shapes/Shape3.svelte";
  import Shape4 from "./svg-shapes/Shape4.svelte";
  import gsap from "gsap";
  import ScrollTrigger from "gsap/dist/ScrollTrigger";
  import Lenis from "lenis";
  import { onMount } from "svelte";

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis();

    lenis.on("scroll", (e: any) => {
      console.log(e);
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  });

  onMount(() => {
    gsap.fromTo(
      "#first-container svg",
      { y: "100%", opacity: 0, duration: 1 },
      { y: 0, opacity: 1, stagger: 0.1 }
    );

    const cols = document.getElementsByClassName("column");

    gsap.to(cols[1], {
      ease: "none",
      scrollTrigger: {
        trigger: cols,
        start: "clamp(top bottom)",
        end: "clamp(bottom top)",
        scrub: true,
      },
      yPercent: -20,
    });

    const colsArray = Array.from(cols);

    colsArray?.forEach((item, index) => {
      if (index === 1) return;

      gsap.to(item, {
        ease: "none",
        startAt: { transformOrigin: index === 0 ? "0% 100%" : "100% 100%" },
        scrollTrigger: {
          trigger: item,
          start: "clamp(top bottom)",
          end: "clamp(bottom top)",
          scrub: true,
        },
        rotation: index === 0 ? -10 : 10,
        xPercent: index === 0 ? -10 : 10,
      });
    });
  });
</script>

<svelte:head>
  <title>Home</title>
  <meta name="description" content="Svelte demo app" />
</svelte:head>

<div id="first-container" class="flex gap-5 justify-evenly mb-6 sticky top-6">
  <Shape1 />
  <Shape2 />
  <Shape3 />
</div>
<Shape4 />
<Shape4 transform="scale(-1,1)" />
<div
  class="columns relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 justify-evenly bg-[#101018] z-40"
>
  <div class="column flex flex-col gap-6">
    <Shape1 />
    <Shape1 />
    <Shape1 />
  </div>
  <div class="column flex flex-col gap-6">
    <Shape2 />
    <Shape2 />
    <Shape2 />
  </div>
  <div class="column flex flex-col gap-6">
    <Shape3 />
    <Shape3 />
    <Shape3 />
  </div>
</div>

<style>
  .column:nth-child(0) {
    transform-origin: bottom left;
  }
  .column:nth-child(3) {
    transform-origin: bottom right;
  }
</style>
