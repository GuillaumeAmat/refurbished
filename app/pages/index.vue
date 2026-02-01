<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

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
let stage: Stage | null = null;

onMounted(() => {
  if (!canvas.value) return;

  stage = new Stage(canvas.value);
});

onBeforeUnmount(() => {
  stage?.dispose();
});
</script>

<template>
  <canvas ref="canvas" class="fixed -z-10 inset-0 outline-0 select-none"></canvas>
</template>
