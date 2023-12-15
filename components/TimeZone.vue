<script setup>
import moment from 'moment'
import { ref } from 'vue';
import Card from './Card.vue';

const currentDateTime = ref(moment().format('h:mm:ss A [CET]'));

setInterval(() => {
    currentDateTime.value = moment().format('h:mm:ss A [CET]');
}, 1000);

</script>

<template>
    <Card :colSpan="'lg:col-span-2'" :rowSpan="'md:row-span-1'" title="Time zone">
        <h2 class="text-xl font-bold">Time zone</h2>
        <p id="timeDisplay"
            class="text-2xl xl:text-5xl w-50 xl:w-100 h-[calc(100%-28px)] font-serif flex justify-left items-center">
            {{ currentDateTime }}
        </p>
    </Card>
</template>
