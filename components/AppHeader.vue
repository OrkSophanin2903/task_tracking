<script setup lang="ts">
import { ref } from 'vue'
import type { TaskRead } from '~/utils/taskMeta'

// Reused on both pages: 'tasks' adds the search box and the List/Board
// toggle in the account menu; 'dashboard' shows only nav + account (with
// theme toggle).
withDefaults(defineProps<{ mode?: 'tasks' | 'dashboard' }>(), { mode: 'tasks' })

const view = defineModel<'list' | 'board'>('view')

const emit = defineEmits<{
  'toggle-sidebar': []
  'select-task': [task: TaskRead]
}>()

const { user, logout } = useAuth()

const accountOpen = ref(false)

function onLogout() {
  accountOpen.value = false
  logout()
}
</script>

<template>
  <header class="app-header">
    <button
      v-if="mode === 'tasks'"
      type="button"
      class="btn btn-icon btn-ghost nav-toggle"
      aria-label="Toggle sidebar"
      @click="emit('toggle-sidebar')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
    </button>

    <NuxtLink to="/" class="wordmark">
      <span class="mark" aria-hidden="true" />
      <span class="word">task<span class="word-dim">tracker</span></span>
    </NuxtLink>

    <nav class="nav" aria-label="Primary">
      <NuxtLink to="/" class="nav-link" exact-active-class="active">Dashboard</NuxtLink>
      <NuxtLink to="/tasks" class="nav-link" active-class="active">Tasks</NuxtLink>
    </nav>

    <div class="right">
      <SearchBox v-if="mode === 'tasks'" @select="(t) => emit('select-task', t)" />

      <div class="menu account">
        <button
          type="button"
          class="account-btn"
          aria-haspopup="menu"
          :aria-expanded="accountOpen"
          aria-label="Account"
          @click="accountOpen = !accountOpen"
        >
          <span class="avatar" aria-hidden="true">{{
            (user?.email?.[0] ?? '?').toUpperCase()
          }}</span>
          <span class="account-email">{{ user?.email }}</span>
        </button>
        <div v-if="accountOpen" class="menu-pop account-pop" role="menu">
          <div class="account-info">
            <span class="account-name">{{ user?.name || user?.email }}</span>
            <span v-if="user?.name" class="account-sub">{{ user?.email }}</span>
          </div>

          <span class="pop-section">Settings</span>

          <div v-if="mode === 'tasks'" class="pop-row">
            <span class="pop-label">View</span>
            <div class="view-toggle" role="tablist" aria-label="View">
              <button
                type="button"
                role="tab"
                class="seg"
                :class="{ active: view === 'list' }"
                :aria-selected="view === 'list'"
                @click="view = 'list'"
              >
                List
              </button>
              <button
                type="button"
                role="tab"
                class="seg"
                :class="{ active: view === 'board' }"
                :aria-selected="view === 'board'"
                @click="view = 'board'"
              >
                Board
              </button>
            </div>
          </div>

          <div class="pop-row">
            <span class="pop-label">Theme</span>
            <ThemeToggle />
          </div>

          <div class="pop-divider" />
          <button
            type="button"
            role="menuitem"
            class="menu-item"
            @click="onLogout"
          >
            Log out
          </button>
        </div>
      </div>
      <div
        v-if="accountOpen"
        class="menu-backdrop"
        @click="accountOpen = false"
      />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--s4);
  height: 52px;
  padding: 0 var(--s5);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--border);
}

.wordmark {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  text-decoration: none;
  border-radius: var(--radius-sm);
}
.mark {
  width: 16px;
  height: 16px;
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
  font-size: 0.9rem;
  letter-spacing: -0.02em;
  color: var(--text);
}
.word-dim {
  color: var(--text-faint);
}

/* Primary nav (Dashboard · Tasks) */
.nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: var(--s3);
}
.nav-link {
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 550;
  color: var(--text-muted);
  text-decoration: none;
  transition: background 0.12s ease, color 0.12s ease;
}
.nav-link:hover {
  background: var(--surface-2);
  color: var(--text);
}
.nav-link.active {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.right {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-left: auto;
  min-width: 0;
}

.view-toggle {
  display: inline-flex;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2px;
}
.seg {
  border: none;
  background: transparent;
  padding: 0.28rem 0.7rem;
  font-size: var(--fs-sm);
  font-weight: 550;
  color: var(--text-muted);
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
}
.seg.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.menu {
  position: relative;
  z-index: 50;
}
.menu-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 200px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: flex;
  flex-direction: column;
}
.menu-item {
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: var(--fs-sm);
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.menu-item:hover {
  background: var(--surface-2);
}
.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
}

/* Account menu */
.account-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 180px;
  padding: 0.2rem 0.5rem 0.2rem 0.2rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.account-btn:hover {
  background: var(--surface-2);
  border-color: var(--border);
}
.avatar {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ink);
  color: var(--on-ink);
  font-size: var(--fs-2xs);
  font-weight: 700;
}
.account-email {
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0.35rem 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.account-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text);
}
.account-sub {
  font-size: var(--fs-2xs);
  color: var(--text-faint);
}

.pop-section {
  display: block;
  padding: 0.3rem 0.55rem 0.15rem;
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-faint);
}
.pop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: 0.3rem 0.55rem;
}
.pop-label {
  font-size: var(--fs-sm);
  color: var(--text-muted);
}
.pop-divider {
  height: 1px;
  margin: 4px 0.55rem;
  background: var(--border);
}

.nav-toggle {
  display: none;
}

/* Mid-size: claw back some space before the mobile layout kicks in. */
@media (max-width: 1100px) {
  .app-header {
    gap: var(--s3);
  }
  .right {
    gap: var(--s2);
  }
  .account-email {
    display: none;
  }
}

@media (max-width: 820px) {
  .nav-toggle {
    display: inline-flex;
  }
  .word {
    display: none;
  }
}
</style>
