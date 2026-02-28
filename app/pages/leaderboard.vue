<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';

import { definePageMeta, useAsyncData } from '#imports';

definePageMeta({
  layout: false,
});

const REFRESH_INTERVAL = 60;

const countdown = ref(REFRESH_INTERVAL);
const lastUpdated = ref<Date | null>(null);
const error = ref(false);

const { data, status, refresh } = await useAsyncData('leaderboard', () =>
  $fetch<Array<{
    id: string;
    player1: string;
    player2: string;
    score: number;
    stars: number;
    date: string;
    rank: number;
  }>>('/api/scores?limit=20'),
);

const scores = computed(() => data.value ?? []);
const loading = computed(() => status.value === 'pending');

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

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

const timer = setInterval(async () => {
  countdown.value -= 1;
  if (countdown.value <= 0) {
    await doRefresh();
  }
}, 1_000);

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <header class="py-8 px-4 text-center border-b border-white/10">
      <h1 class="text-3xl font-bold tracking-tight">
        <span class="text-yellow-400">Refurbished!</span>
      </h1>
      <p class="mt-1 text-lg text-white/60 uppercase tracking-widest text-sm">Leaderboard</p>
    </header>

    <main class="flex-1 px-4 py-8 max-w-3xl w-full mx-auto">
      <!-- Loading -->
      <div v-if="loading" class="text-center text-white/50 py-16">Loading…</div>

      <!-- Error -->
      <div v-else-if="error" class="text-center text-red-400 py-16">Failed to load — retrying…</div>

      <!-- Empty -->
      <div v-else-if="scores.length === 0" class="text-center text-white/50 py-16">No scores yet</div>

      <!-- Desktop table -->
      <table v-else class="hidden md:table w-full border-collapse text-sm">
        <thead>
          <tr class="text-white/40 uppercase text-xs tracking-widest border-b border-white/10">
            <th class="py-3 text-left w-10">#</th>
            <th class="py-3 text-left">Players</th>
            <th class="py-3 text-right">Score</th>
            <th class="py-3 text-center">Stars</th>
            <th class="py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in scores"
            :key="entry.id"
            class="border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <td class="py-3 text-white/40 font-mono">{{ entry.rank }}</td>
            <td class="py-3">
              <span class="font-semibold">{{ entry.player1 }}</span>
              <span class="text-white/40 mx-1">&</span>
              <span class="font-semibold">{{ entry.player2 }}</span>
            </td>
            <td class="py-3 text-right font-mono text-yellow-400 font-bold">{{ entry.score.toLocaleString() }}</td>
            <td class="py-3 text-center tracking-tight">
              <span v-for="i in 3" :key="i" :class="i <= entry.stars ? 'text-yellow-400' : 'text-white/20'">★</span>
            </td>
            <td class="py-3 text-right text-white/40">{{ formatDate(entry.date) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="md:hidden space-y-3">
        <div
          v-for="entry in scores"
          :key="entry.id"
          class="border border-white/10 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-white/40 text-xs font-mono">#{{ entry.rank }}</span>
            <span class="text-yellow-400 font-bold font-mono text-lg">{{ entry.score.toLocaleString() }}</span>
          </div>
          <div class="text-sm font-semibold mb-1">
            {{ entry.player1 }} <span class="text-white/40">&</span> {{ entry.player2 }}
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="tracking-tight">
              <span v-for="i in 3" :key="i" :class="i <= entry.stars ? 'text-yellow-400' : 'text-white/20'">★</span>
            </span>
            <span class="text-white/40 text-xs">{{ formatDate(entry.date) }}</span>
          </div>
        </div>
      </div>
    </main>

    <footer class="py-4 px-4 text-center text-white/30 text-xs border-t border-white/10 space-y-1">
      <p>Refreshing in <span class="text-yellow-400 font-mono">{{ countdown }}s</span></p>
      <p v-if="lastUpdated">Last updated {{ formatTime(lastUpdated) }}</p>
    </footer>
  </div>
</template>
