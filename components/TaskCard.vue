<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  STATUSES,
  formatDate,
  isOverdue,
  type ProjectRead,
  type TagRead,
  type TaskRead,
  type TaskStatus,
} from '~/utils/taskMeta'

const props = defineProps<{
  task: TaskRead
  projects: ProjectRead[]
  tags: TagRead[]
  /** Board context: show a grip handle and render as a compact card. */
  draggable?: boolean
  /** List context: show status controls and render as a dense row. */
  showStatusControls?: boolean
}>()

const emit = defineEmits<{ deleted: [id: number]; edit: [task: TaskRead] }>()

const supabase = useSupabase()
const { push: pushToast } = useToasts()

const project = computed<ProjectRead | null>(() => {
  if (props.task.project_id == null) return null
  return props.projects.find((p) => p.id === props.task.project_id) ?? null
})

const cardTags = computed<TagRead[]>(() => {
  const byId = new Map(props.tags.map((t) => [t.id, t]))
  return props.task.tag_ids
    .map((id) => byId.get(id))
    .filter((t): t is TagRead => t != null)
})

function chipStyle(tag: TagRead): Record<string, string> | undefined {
  return tag.color
    ? { background: tag.color, color: '#fff', borderColor: tag.color }
    : undefined
}

// --- Status (optimistic, reconciled from server) ---
async function changeStatus(newStatus: TaskStatus) {
  if (props.task.status === newStatus) return
  const previous = props.task.status
  props.task.status = newStatus // optimistic
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', props.task.id)
    .select()
    .single()
  if (error || !data) {
    props.task.status = previous // revert
    pushToast(`Could not update "${props.task.title}".`)
    return
  }
  Object.assign(props.task, data)
}

// --- Delete ---
const deleting = ref(false)

async function remove() {
  if (!confirm(`Delete "${props.task.title}"? This cannot be undone.`)) return
  deleting.value = true
  const { error } = await supabase.from('tasks').delete().eq('id', props.task.id)
  deleting.value = false
  if (error) {
    pushToast(`Could not delete "${props.task.title}".`)
    return
  }
  emit('deleted', props.task.id)
}

// --- Row actions menu (kebab) — teleported + fixed so the table's
// overflow clipping doesn't cut it off. ---
const menuOpen = ref(false)
const menuBtn = ref<HTMLButtonElement | null>(null)
const menuPos = ref<{ top: number; right: number }>({ top: 0, right: 0 })

function toggleMenu() {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  const rect = menuBtn.value?.getBoundingClientRect()
  if (rect) {
    menuPos.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right }
  }
  menuOpen.value = true
}
function closeMenu() {
  menuOpen.value = false
}
function onEdit() {
  closeMenu()
  emit('edit', props.task)
}
function onDelete() {
  closeMenu()
  void remove()
}

function onEsc(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}
watch(menuOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', onEsc)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
  } else {
    window.removeEventListener('keydown', onEsc)
    window.removeEventListener('scroll', closeMenu, true)
    window.removeEventListener('resize', closeMenu)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
})
</script>

<template>
  <article
    class="card"
    :class="[
      draggable ? 'as-card' : 'as-row',
      `rail-${task.priority}`,
      { 'is-overdue': isOverdue(task) },
    ]"
  >
    <!-- Board card -->
    <template v-if="draggable">
      <div class="bc-top">
        <span class="drag-handle" title="Drag to reorder or move" aria-hidden="true">⠿</span>
        <h3 class="bc-title">{{ task.title }}</h3>
        <span class="prio" :class="`prio-${task.priority}`">{{ task.priority }}</span>
      </div>
      <p v-if="task.description" class="bc-desc">{{ task.description }}</p>
      <div v-if="project || task.due_date || cardTags.length" class="bc-meta">
        <span v-if="project" class="chip">
          <span class="chip-dot" :style="project.color ? { background: project.color } : undefined" />
          {{ project.name }}
        </span>
        <span v-for="t in cardTags" :key="t.id" class="tag-chip" :style="chipStyle(t)">
          {{ t.name }}
        </span>
        <span v-if="task.due_date" class="due" :class="{ overdue: isOverdue(task) }">
          <span aria-hidden="true">◷</span>
          <span class="num">{{ formatDate(task.due_date) }}</span>
          <span v-if="isOverdue(task)" class="overdue-tag">Overdue</span>
        </span>
      </div>
      <div class="bc-actions">
        <button type="button" class="btn btn-sm btn-ghost" @click="emit('edit', task)">Edit</button>
        <button
          type="button"
          class="btn btn-sm btn-danger"
          :disabled="deleting"
          @click="remove"
        >
          {{ deleting ? 'Deleting…' : 'Delete' }}
        </button>
      </div>
    </template>

    <!-- List row (table) -->
    <template v-else>
      <span class="cell cell-title" :title="task.title">{{ task.title }}</span>

      <span class="cell cell-prio">
        <span class="prio" :class="`prio-${task.priority}`">{{ task.priority }}</span>
      </span>

      <span class="cell cell-project">
        <span v-if="project" class="chip">
          <span class="chip-dot" :style="project.color ? { background: project.color } : undefined" />
          {{ project.name }}
        </span>
      </span>

      <span class="cell cell-tags">
        <span v-for="t in cardTags" :key="t.id" class="tag-chip" :style="chipStyle(t)">
          {{ t.name }}
        </span>
      </span>

      <span class="cell cell-due">
        <span v-if="task.due_date" class="due" :class="{ overdue: isOverdue(task) }">
          <span aria-hidden="true">◷</span>
          <span class="num">{{ formatDate(task.due_date) }}</span>
          <span v-if="isOverdue(task)" class="overdue-tag">Overdue</span>
        </span>
      </span>

      <span class="cell cell-status">
        <select
          v-if="showStatusControls"
          class="status-select"
          :class="`status-${task.status}`"
          :value="task.status"
          aria-label="Status"
          @change="changeStatus(($event.target as HTMLSelectElement).value as TaskStatus)"
        >
          <option v-for="s in STATUSES" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>
      </span>

      <span class="cell cell-actions">
        <button
          ref="menuBtn"
          type="button"
          class="btn btn-ghost row-menu-btn"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          aria-label="Task actions"
          @click="toggleMenu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
        </button>

        <Teleport to="body">
          <template v-if="menuOpen">
            <div class="row-menu-backdrop" @click="closeMenu" />
            <div
              class="row-menu"
              role="menu"
              :style="{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }"
            >
              <button
                type="button"
                role="menuitem"
                class="row-menu-item"
                @click="onEdit"
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                class="row-menu-item is-danger"
                :disabled="deleting"
                @click="onDelete"
              >
                Delete
              </button>
            </div>
          </template>
        </Teleport>
      </span>
    </template>
  </article>
</template>

<style scoped>
.card {
  background: var(--surface);
  color: var(--text);
}
.prio {
  flex-shrink: 0;
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.4rem;
  border-radius: var(--radius-sm);
}
.prio-high {
  background: var(--prio-high-bg);
  color: var(--prio-high-fg);
}
.prio-medium {
  background: var(--prio-medium-bg);
  color: var(--prio-medium-fg);
}
.prio-low {
  background: var(--prio-low-bg);
  color: var(--prio-low-fg);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  font-size: var(--fs-xs);
  font-weight: 550;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem 0.1rem 0.4rem;
}
.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}
.tag-chip {
  flex-shrink: 0;
  font-size: var(--fs-2xs);
  font-weight: 600;
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
}
.due {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.due.overdue {
  color: var(--danger);
  font-weight: 600;
}
.overdue-tag {
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--danger);
  color: #fff;
  padding: 0.05rem 0.35rem;
  border-radius: var(--radius-pill);
}

/* ---- board card ---- */
.as-card {
  border: 1px solid var(--border);
  border-left: 2px solid var(--border-strong);
  border-radius: var(--radius);
  padding: var(--s4);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  transition: box-shadow 0.14s ease, border-color 0.14s ease;
}
.as-card:hover {
  box-shadow: var(--shadow);
}
.as-card.rail-high {
  border-left-color: var(--prio-high-fg);
}
.as-card.rail-medium {
  border-left-color: var(--prio-medium-fg);
}
.as-card.is-overdue {
  border-left-color: var(--danger);
}
.bc-top {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}
.drag-handle {
  cursor: grab;
  color: var(--text-faint);
  font-size: 0.9rem;
  line-height: 1.3;
  letter-spacing: -2px;
  user-select: none;
}
.drag-handle:active {
  cursor: grabbing;
}
.bc-title {
  flex: 1;
  font-size: var(--fs-md);
  font-weight: 550;
  line-height: 1.3;
  word-break: break-word;
}
.bc-desc {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}
.bc-actions {
  display: flex;
  gap: var(--s2);
  margin-top: var(--s1);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.as-card:hover .bc-actions,
.as-card:focus-within .bc-actions {
  opacity: 1;
}

/* ---- list row (table) ---- */
.as-row {
  display: grid;
  grid-template-columns: var(--list-grid);
  align-items: center;
  gap: var(--s3);
  padding: 0.5rem var(--s4);
  transition: background 0.12s ease;
}
.as-row:hover {
  background: var(--surface-2);
}
.cell {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.cell-title {
  display: block;
  font-size: var(--fs-base);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell-tags {
  overflow: hidden;
}
/* Status dropdown — box is tinted/colored by the current status. */
.status-select {
  width: 100%;
  padding: 0.26rem 0.5rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.status-select option {
  color: var(--text);
  background: var(--surface);
  font-weight: 500;
}
.status-select.status-todo {
  color: var(--status-todo);
  border-color: color-mix(in srgb, var(--status-todo) 50%, transparent);
  background: color-mix(in srgb, var(--status-todo) 12%, var(--surface));
}
.status-select.status-in_progress {
  color: var(--status-in_progress);
  border-color: color-mix(in srgb, var(--status-in_progress) 55%, transparent);
  background: color-mix(in srgb, var(--status-in_progress) 13%, var(--surface));
}
.status-select.status-done {
  color: var(--status-done);
  border-color: color-mix(in srgb, var(--status-done) 55%, transparent);
  background: color-mix(in srgb, var(--status-done) 13%, var(--surface));
}
.cell-actions {
  justify-content: flex-end;
}
.row-menu-btn {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  color: var(--text-faint);
}
.row-menu-btn:hover {
  color: var(--text);
}

/* Teleported to <body>, but Vue keeps the scoped data attr so these apply. */
.row-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}
.row-menu {
  position: fixed;
  z-index: 91;
  min-width: 150px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
}
.row-menu-item {
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: var(--fs-sm);
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.row-menu-item:hover:not(:disabled) {
  background: var(--surface-2);
}
.row-menu-item.is-danger {
  color: var(--danger);
}
.row-menu-item.is-danger:hover:not(:disabled) {
  background: var(--danger-soft);
}
.row-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
