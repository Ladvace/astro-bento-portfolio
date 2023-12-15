<script setup>
import { reactive } from 'vue';
const posts = reactive([
    'Vue + Pinia made simple',
    'Vue + Nuxt made simple',
    'How to port a project from another Framework',
])

</script>
<template>
    <Card colSpan="md:col-span-1" rowSpan="md:row-span-3" href="/">
        <h2 class="text-xl font-bold m-0 z-20">Blog</h2>
        <p class="text-xs text-gray-500 mb-1">Latest from the blog</p>
        <p class="text-sm font-light text-base hover:text-red-500" v-for="(post, index) in posts" :key="index">
            <router-link to="/">
                - {{ post }}
            </router-link>
        </p>
    </Card>
</template>