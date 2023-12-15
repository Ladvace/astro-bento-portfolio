<template>
    <div
        :class="`card group overflow-hidden transform-y-[-40%] bg-darkslate-500 shadow-lg rounded-lg p-6 border border-darkslate-100 hover:border-primary-500 align-start flex-none h-full justify-start relative transform perspective-1200 w-full transition duration-75 ease-in-out col-span-1 ${colSpan || 'md:col-span-2'} ${rowSpan || ''}`">
        <slot />
    </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
    colSpan: String,
    rowSpan: String,
});
</script>
