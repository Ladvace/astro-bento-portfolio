<script setup>
import { onMounted, ref } from 'vue';
import { stagger, spring, timeline } from "motion";

const cards = ref([]);

const animateCards = () => {
    cards.value = document.querySelectorAll(".card");
    const sequence = [
        [
            cards.value,
            { y: ["40%", "0%"], opacity: [0, 1] },
            {
                at: "-0.1",
                duration: 0.4,
                delay: stagger(0.3),
                easing: spring({ velocity: 100, stiffness: 50, damping: 10 }),
            },
        ],
    ];
    timeline(sequence);
};

onMounted(animateCards);

useSeoMeta({
    title: 'Andrea Puglisi - Software Developer in Italy',
    ogTitle: 'Andrea Puglisi - Software Developer in Italy',
    description: 'Hello! I am Andrea and this is my website 🙂.',
    ogDescription: 'Hello! I am Andrea and this is my website 🙂.',
    ogImage: './me/me1.png',
    twitterCard: './me/me1.png',
})

</script>
<template>
    <Intro />
    <About />
    <Contact />
    <TimeZone />
    <Blog />
    <CurrentWeather />
    <Currently />
    <Copyright />
</template>
