<script setup>
useHead({
    bodyAttrs: {
        class: computed(() => {
            return 'bg-darkslate-700 md:h-screen flex flex-col justify-center items-center';
        }),
    },
});
</script>
<template>
    <NuxtLayout>
        <NuxtPage />
    </NuxtLayout>
</template>
