<script setup lang="ts">
import { ref } from 'vue'

const { login } = useAuth()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await login(email.value.trim(), password.value)
    await navigateTo('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth">
    <div class="auth-top">
      <ThemeToggle />
    </div>
    <div class="auth-card">
      <div class="wordmark">
        <span class="mark" aria-hidden="true" />
        <span class="word">task<span class="word-dim">tracker</span></span>
      </div>
      <h1 class="auth-title">Sign in</h1>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="eyebrow">Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label class="field">
          <span class="eyebrow">Password</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button
          type="submit"
          class="btn btn-primary auth-submit"
          :disabled="submitting"
        >
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="auth-alt">
        No account?
        <NuxtLink to="/register" class="auth-link">Create one</NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s5);
  background: var(--bg);
}
.auth-top {
  position: fixed;
  top: var(--s4);
  right: var(--s4);
}
.auth-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--s6);
}
.wordmark {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.mark {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--ink);
  position: relative;
}
.mark::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 1px;
  background: var(--accent);
}
.word {
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
}
.word-dim {
  color: var(--text-faint);
}
.auth-title {
  margin: var(--s5) 0 var(--s4);
  font-size: var(--fs-lg);
  font-weight: 600;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.error {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--danger);
}
.auth-submit {
  width: 100%;
  justify-content: center;
  margin-top: var(--s1);
}
.auth-alt {
  margin: var(--s5) 0 0;
  font-size: var(--fs-sm);
  color: var(--text-muted);
}
.auth-link {
  color: var(--accent-text);
  font-weight: 550;
  text-decoration: none;
}
</style>
