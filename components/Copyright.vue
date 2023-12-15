
<script setup>
import moment from 'moment';
</script>
<template>
    <Card colSpan="md:col-span-1" rowSpan="md:row-span-2">
        <p class="text-xs mt-3">
            Forked with ♥️ by Andrea Puglisi using <a href="https://nuxt.com/" target="_blank" class="text-red-500">Nuxt</a>
            from <a href="https://gianmarco.xyz/" target="_blank" class="text-red-500">Gianmarco Cavallo</a>. © {{
                moment().format('Y') }}
        </p>
    </Card>
</template>