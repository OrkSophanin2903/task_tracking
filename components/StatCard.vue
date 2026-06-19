<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | string
    sub?: string
    tone?: 'default' | 'todo' | 'in_progress' | 'done' | 'overdue' | 'accent'
    /** When set, the card becomes a NuxtLink to this route (quick tracking). */
    to?: string
  }>(),
  { tone: 'default' },
)

// Plain card by default; a navigable link when `to` is provided.
const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    class="stat-card"
    :class="[`tone-${tone}`, { 'is-link': to }]"
  >
    <span class="stat-label">{{ label }}</span>
    <span class="stat-value num">{{ value }}</span>
    <span v-if="sub" class="stat-sub num">{{ sub }}</span>
  </component>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: var(--s4) var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.14s ease, box-shadow 0.14s ease,
    transform 0.04s ease;
}
.stat-card.is-link {
  cursor: pointer;
}
.stat-card.is-link:hover {
  box-shadow: var(--shadow);
  border-color: var(--border-strong);
}
.stat-card.is-link:active {
  transform: translateY(0.5px);
}

.stat-label {
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-faint);
}
.stat-value {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.stat-sub {
  font-size: var(--fs-xs);
  color: var(--text-muted);
}

/* Tone = coloured left rail + value tint (colour paired with the label text). */
.tone-todo {
  border-left-color: var(--status-todo);
}
.tone-in_progress {
  border-left-color: var(--status-in_progress);
}
.tone-in_progress .stat-value {
  color: var(--status-in_progress);
}
.tone-done {
  border-left-color: var(--status-done);
}
.tone-done .stat-value {
  color: var(--status-done);
}
.tone-overdue {
  border-left-color: var(--danger);
}
.tone-overdue .stat-value {
  color: var(--danger);
}
.tone-accent {
  border-left-color: var(--accent);
}
.tone-accent .stat-value {
  color: var(--accent-text);
}
</style>
