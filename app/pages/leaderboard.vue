<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';

import { definePageMeta, useAsyncData, useRuntimeConfig } from '#imports';

definePageMeta({
  layout: false,
});

const LEADERBOARD_LIMIT = 15;
const REFRESH_INTERVAL = 60;

const countdown = ref(REFRESH_INTERVAL);
const lastUpdated = ref<Date | null>(null);
const error = ref(false);

const { data, status, refresh } = await useAsyncData('leaderboard', () =>
  $fetch<
    Array<{
      id: string;
      player1: string;
      player2: string;
      score: number;
      rank: number;
    }>
  >(`/api/scores?limit=${LEADERBOARD_LIMIT}`),
);

const scores = computed(() => data.value ?? []);
const loading = computed(() => status.value === 'pending');

const rows = computed(() => {
  const result = [];
  for (let i = 0; i < LEADERBOARD_LIMIT; i++) {
    const entry = scores.value[i];
    result.push(
      entry
        ? { rank: entry.rank, names: `${entry.player1} & ${entry.player2}`, score: entry.score, isPlaceholder: false }
        : { rank: i + 1, names: '.........', score: 0, isPlaceholder: true },
    );
  }
  return result;
});

async function doRefresh() {
  error.value = false;
  try {
    await refresh();
    lastUpdated.value = new Date();
  } catch {
    error.value = true;
  }
  countdown.value = REFRESH_INTERVAL;
}

lastUpdated.value = new Date();

const { leaderboardAutoRefreshEnabled } = useRuntimeConfig().public;

const timer = leaderboardAutoRefreshEnabled
  ? setInterval(async () => {
      countdown.value -= 1;
      if (countdown.value <= 0) {
        await doRefresh();
      }
    }, 1_000)
  : null;

onUnmounted(() => {
  if (timer !== null) clearInterval(timer);
});
</script>

<template>
  <div class="min-h-screen bg-white flex justify-center px-4 py-8">
    <div class="w-full max-w-md flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col items-start gap-1">
        <span
          class="inline-block text-black text-sm font-semibold leading-none px-2 py-1 mb-2"
          style="background: #e2f77e; font-family: 'BMDupletDSP', system-ui, sans-serif"
          >TOP 15</span
        >
        <div class="text-4xl text-black" style="font-family: 'IvarSoft', serif; font-weight: 600">The</div>
        <div class="text-4xl text-black italic" style="font-family: 'IvarSoft', serif; font-weight: 600">
          Leaderboard.
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1">
        <div v-if="loading" class="text-[#888] py-8" style="font-family: 'RobotoMono', monospace">Loading…</div>
        <div v-else-if="error" class="text-red-600 py-8" style="font-family: 'RobotoMono', monospace">
          Failed to load — retrying…
        </div>

        <div v-else class="bg-[#F0F0F0] rounded-xl overflow-hidden py-4 px-5">
          <div
            v-for="(row, i) in rows"
            :key="i"
            class="grid items-center px-4 py-2 text-black"
            :class="[i < 5 ? 'font-bold' : 'font-normal']"
            style="grid-template-columns: 1.8rem 1fr 3rem; font-family: 'RobotoMono', monospace"
          >
            <!-- Rank -->
            <span class="relative flex items-center justify-center">
              <span
                v-if="i < 5"
                class="absolute bg-[#CDB4F2] -inset-2"
                :class="[
                  i === 0 ? 'rounded-t-full rounded-b-none' : '',
                  i === 4 ? 'rounded-t-none rounded-b-full' : '',
                  i > 0 && i < 4 ? 'rounded-none' : '',
                ]"
                aria-hidden="true"
              />
              <span class="relative z-10">{{ row.rank }}</span>
            </span>
            <!-- Names -->
            <span class="px-2 truncate text-center">{{ row.names }}</span>
            <!-- Score -->
            <span class="text-right whitespace-nowrap">{{ row.score }}</span>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style>
@font-face {
  font-family: 'BMDupletDSP';
  font-weight: 600;
  src: url('/game/font/BMDupletDSP-Semibold.woff2') format('woff2');
}

@font-face {
  font-family: 'IvarSoft';
  font-weight: 600;
  font-style: normal;
  src: url('/game/font/IvarSoft-SemiBold.woff2') format('woff2');
}

@font-face {
  font-family: 'IvarSoft';
  font-weight: 600;
  font-style: italic;
  src: url('/game/font/IvarSoft-SemiBoldItalic.woff2') format('woff2');
}

@font-face {
  font-family: 'RobotoMono';
  font-weight: 400;
  src: url('/game/font/RobotoMono-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'RobotoMono';
  font-weight: 700;
  src: url('/game/font/RobotoMono-Bold.woff2') format('woff2');
}
</style>
