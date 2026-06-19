<script setup lang="ts">
import { ref } from 'vue'

const { register } = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  submitting.value = true
  try {
    await register(email.value.trim(), password.value, name.value)
    await navigateTo('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign up failed.'
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
      <h1 class="auth-title">Create your account</h1>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="eyebrow">Name <span class="opt">(optional)</span></span>
          <input
            v-model="name"
            type="text"
            autocomplete="name"
            placeholder="Your name"
          />
        </label>
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
            autocomplete="new-password"
            required
            minlength="8"
            placeholder="At least 8 characters"
          />
        </label>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button
          type="submit"
          class="btn btn-primary auth-submit"
          :disabled="submitting"
        >
          {{ submitting ? 'Creating…' : 'Create account' }}
        </button>
      </form>

      <p class="auth-alt">
        Already have an account?
        <NuxtLink to="/login" class="auth-link">Sign in</NuxtLink>
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
.opt {
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-faint);
  font-weight: 400;
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
