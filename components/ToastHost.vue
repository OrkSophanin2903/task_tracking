<script setup lang="ts">
const { toasts, dismiss } = useToasts()
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.type}`"
      role="alert"
    >
      <span class="toast-msg">{{ toast.message }}</span>
      <button
        type="button"
        class="toast-close"
        aria-label="Dismiss notification"
        @click="dismiss(toast.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(360px, calc(100vw - 2rem));
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-left: 4px solid var(--text-faint);
  box-shadow: var(--shadow-lg);
  font-size: 0.85rem;
}
.toast-error {
  border-left-color: var(--danger);
}
.toast-success {
  border-left-color: var(--status-done);
}
.toast-info {
  border-left-color: var(--accent);
}
.toast-msg {
  flex: 1;
}
.toast-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  padding: 0.1rem;
}
.toast-close:hover {
  color: var(--text);
}
</style>
