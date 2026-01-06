<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { definePageMeta, useSimpleHead } from '#imports';
import { BACKGROUND_COLOR } from '~~/game/constants';
import { Stage } from '~~/game/Stage';

definePageMeta({
  layout: false,
});

useSimpleHead({
  title: 'Refurbished!',
  description: 'Unofficial Back Market themed web video game',
  suffixedTitle: false,
  htmlAttrs: {
    style: `background-color: ${BACKGROUND_COLOR};`,
  },
  bodyAttrs: {
    style: `background-color: ${BACKGROUND_COLOR};`,
  },
});

const canvas = ref<HTMLCanvasElement>();

onMounted(() => {
  if (!canvas.value) return;

  new Stage(canvas.value);
});
</script>

<template>
  <canvas ref="canvas" class="fixed -z-10 inset-0 outline-0 select-none"></canvas>
</template>
