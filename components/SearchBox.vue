<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { STATUSES, type TaskRead } from '~/utils/taskMeta'
import { TASK_SELECT, mapTask, searchFilter } from '~/utils/tasksApi'

const emit = defineEmits<{ select: [task: TaskRead] }>()

const supabase = useSupabase()
const { push: pushToast } = useToasts()

const term = ref('')
const results = ref<TaskRead[]>([])
const open = ref(false)
const loading = ref(false)
const highlighted = ref(-1)

// On narrow screens the search collapses to an icon button; tapping it
// expands the input into a full-width overlay.
const expanded = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

async function expand() {
  expanded.value = true
  await nextTick()
  inputEl.value?.focus()
}
function collapse() {
  expanded.value = false
  open.value = false
}

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label]),
)

let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  clearTimeout(timer)
  if (!value.trim()) {
    results.value = []
    open.value = false
    return
  }
  timer = setTimeout(runSearch, 200)
})

async function runSearch() {
  loading.value = true
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .or(searchFilter(term.value.trim()))
    .limit(8)
  loading.value = false
  if (error || !data) {
    pushToast('Search failed.')
    return
  }
  results.value = data.map(mapTask)
  highlighted.value = results.value.length ? 0 : -1
  open.value = true
}

function choose(task: TaskRead) {
  emit('select', task)
  term.value = ''
  results.value = []
  open.value = false
  expanded.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (open.value) open.value = false
    else collapse()
    return
  }
  if (!open.value || !results.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlighted.value = (highlighted.value + 1) % results.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlighted.value =
      (highlighted.value - 1 + results.value.length) % results.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const task = results.value[highlighted.value]
    if (task) choose(task)
  }
}
</script>

<template>
  <div class="search" :class="{ expanded }">
    <button
      type="button"
      class="search-toggle-btn"
      aria-label="Search tasks"
      @click="expand"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    </button>

    <div class="search-box">
      <svg class="search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input
        ref="inputEl"
        v-model="term"
        type="search"
        class="search-input"
        placeholder="Search tasks…"
        role="combobox"
        aria-label="Search tasks"
        aria-autocomplete="list"
        :aria-expanded="open"
        @focus="open = results.length > 0"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="search-close-btn"
        aria-label="Close search"
        @click="collapse"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      <div v-if="open" class="results-backdrop" @click="open = false" />
      <ul v-if="open" class="results" role="listbox">
        <li v-if="loading" class="result-empty">Searching…</li>
        <template v-else-if="results.length">
          <li
            v-for="(task, i) in results"
            :key="task.id"
            role="option"
            :aria-selected="i === highlighted"
            class="result"
            :class="{ active: i === highlighted }"
            @mouseenter="highlighted = i"
            @mousedown.prevent="choose(task)"
          >
            <span class="r-dot" :class="`s-${task.status}`" />
            <span class="r-title">{{ task.title }}</span>
            <span class="r-status">{{ STATUS_LABEL[task.status] }}</span>
          </li>
        </template>
        <li v-else class="result-empty">No tasks match “{{ term }}”.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  width: 280px;
  min-width: 0;
  display: flex;
  align-items: center;
}
.search-toggle-btn {
  display: none;
}
.search-box {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}
.search-ico {
  position: absolute;
  left: 0.6rem;
  color: var(--text-faint);
  pointer-events: none;
}
.search-input {
  flex: 1 1 auto;
  min-width: 0;
  padding-left: 1.9rem;
  height: 32px;
  background: var(--surface-2);
  border-color: transparent;
}
.search-input:focus {
  background: var(--surface);
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.search-close-btn {
  display: none;
  z-index: 62;
}

.results-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.results {
  position: absolute;
  z-index: 61;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  max-height: 360px;
  overflow-y: auto;
}
.result {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: 0.4rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.result.active {
  background: var(--accent-soft);
}
.r-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.r-dot.s-todo {
  background: var(--status-todo);
}
.r-dot.s-in_progress {
  background: var(--status-in_progress);
}
.r-dot.s-done {
  background: var(--status-done);
}
.r-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.r-status {
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  flex-shrink: 0;
}
.result-empty {
  padding: 0.5rem;
  font-size: var(--fs-sm);
  color: var(--text-faint);
}

/* Collapse to an icon button; tapping it turns the search into the
   header bar itself (same height/width, no page-dimming overlay). */
@media (max-width: 820px) {
  .search {
    width: auto;
  }
  .search-toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--text-muted);
    cursor: pointer;
  }
  .search-toggle-btn:hover {
    background: var(--surface-2);
  }
  .search-box {
    display: none;
  }
  .search-close-btn {
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    color: var(--text-muted);
    cursor: pointer;
  }
  .search-close-btn:hover {
    background: var(--surface-3);
  }

  .search.expanded .search-toggle-btn {
    display: none;
  }
  .search.expanded .search-box {
    display: flex;
    position: absolute;
    inset: 0;
    z-index: 55;
    gap: var(--s2);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .search.expanded .search-close-btn {
    display: inline-flex;
  }
}
</style>
