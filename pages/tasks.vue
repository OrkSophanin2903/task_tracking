<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { SidebarCounts } from '~/components/AppSidebar.vue'
import type { ImportDocument } from '~/types/supabase'
import {
  PRIORITY_RANK,
  STATUSES,
  type ProjectRead,
  type TagRead,
  type TaskPriority,
  type TaskRead,
  type TaskStatus,
} from '~/utils/taskMeta'
import { TASK_SELECT, mapTask } from '~/utils/tasksApi'
import { downloadExcelBackup, parseExcelBackup } from '~/utils/backupExcel'

type SortBy = 'position' | 'priority' | 'due_date' | 'created_at'
type SortOrder = 'asc' | 'desc'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'position', label: 'Manual order' },
  { value: 'priority', label: 'Priority' },
  { value: 'due_date', label: 'Due date' },
  { value: 'created_at', label: 'Created' },
]
const PAGE_SIZES = [15, 25, 50, 100]

const supabase = useSupabase()
const { push: pushToast } = useToasts()

// --- Deep-link filters: the dashboard (and elsewhere) can jump here with the
// list pre-filtered via query params, e.g. /tasks?status=todo or ?project=0. ---
const route = useRoute()
function queryStr(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return undefined
}
function parseStatus(v: unknown): TaskStatus | '' {
  const s = queryStr(v)
  return STATUSES.some((x) => x.value === s) ? (s as TaskStatus) : ''
}
function parseIdOrNull(v: unknown): number | null {
  const s = queryStr(v)
  if (s == null) return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : null
}
function parseSort(v: unknown): SortBy {
  const s = queryStr(v)
  return SORT_OPTIONS.some((o) => o.value === s) ? (s as SortBy) : 'position'
}
function parseOrder(v: unknown): SortOrder {
  const s = queryStr(v)
  return s === 'asc' || s === 'desc' ? s : 'asc'
}

// --- Filters that drive the GET /tasks query. projectFilter: null = all,
// 0 = unassigned (project_id IS NULL), or a specific project id. tagFilter:
// null = all, or a specific tag id. (Free-text search lives in the header's
// SearchBox combobox and opens tasks directly; it doesn't filter the list.) ---
const projectFilter = ref<number | null>(parseIdOrNull(route.query.project))
const tagFilter = ref<number | null>(parseIdOrNull(route.query.tag))
const hasActiveFilter = computed(
  () => projectFilter.value !== null || tagFilter.value !== null,
)

const {
  data: tasks,
  pending,
  error,
  refresh,
} = await useAsyncData<TaskRead[]>(
  'tasks',
  async () => {
    // tag_id filters by which tasks carry that tag; resolve the id list first
    // so the main query's `task_tags` embed still returns each task's *full*
    // tag set (a filtered embed would only return the matching link).
    let taskIds: number[] | null = null
    if (tagFilter.value !== null) {
      const { data, error: fetchError } = await supabase
        .from('task_tags')
        .select('task_id')
        .eq('tag_id', tagFilter.value)
      if (fetchError) throw new Error('Failed to load tasks')
      taskIds = (data ?? []).map((r) => r.task_id)
      if (taskIds.length === 0) return []
    }

    let query = supabase.from('tasks').select(TASK_SELECT).order('position')
    if (projectFilter.value === 0) {
      query = query.is('project_id', null)
    } else if (projectFilter.value !== null) {
      query = query.eq('project_id', projectFilter.value)
    }
    if (taskIds) query = query.in('id', taskIds)

    const { data, error: fetchError } = await query
    if (fetchError || !data) {
      throw new Error('Failed to load tasks')
    }
    return data.map(mapTask)
  },
  { watch: [projectFilter, tagFilter] },
)

const { data: projects, refresh: refreshProjects } = await useAsyncData<
  ProjectRead[]
>('projects', async () => {
  const { data, error: fetchError } = await supabase
    .from('projects')
    .select('*')
    .order('id')
  if (fetchError || !data) {
    throw new Error('Failed to load projects')
  }
  return data
})

const { data: tags, refresh: refreshTags } = await useAsyncData<TagRead[]>(
  'tags',
  async () => {
    const { data, error: fetchError } = await supabase
      .from('tags')
      .select('*')
      .order('name')
    if (fetchError || !data) {
      throw new Error('Failed to load tags')
    }
    return data
  },
)

// --- Sidebar counts: independent of the filtered `tasks` list above, so the
// nav always shows totals for every project/tag regardless of the current
// filter. ---
const { data: sidebarCounts, refresh: refreshCounts } =
  await useAsyncData<SidebarCounts>('task-counts', async () => {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('project_id, task_tags(tag_id)')
    if (fetchError || !data) {
      throw new Error('Failed to load task counts')
    }
    const projects: Record<number, number> = {}
    const tags: Record<number, number> = {}
    let unassigned = 0
    for (const task of data) {
      if (task.project_id == null) {
        unassigned++
      } else {
        projects[task.project_id] = (projects[task.project_id] ?? 0) + 1
      }
      for (const { tag_id } of task.task_tags) {
        tags[tag_id] = (tags[tag_id] ?? 0) + 1
      }
    }
    return { all: data.length, unassigned, projects, tags }
  })

const taskCount = computed(() => tasks.value?.length ?? 0)
const sidebarOpen = ref(false) // mobile drawer

// --- View toggle (List is the default / primary view) ---
const view = ref<'list' | 'board'>('list')

// --- List view: client-side status filter + sort (mirrors the API's ordering). ---
const statusFilter = ref<TaskStatus | ''>(parseStatus(route.query.status))
const sortBy = ref<SortBy>(parseSort(route.query.sort))
const order = ref<SortOrder>(parseOrder(route.query.order))

function tieBreak(a: TaskRead, b: TaskRead): number {
  if (a.position !== b.position) return a.position - b.position
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1
  }
  return a.id - b.id
}

const visibleTasks = computed<TaskRead[]>(() => {
  const all = tasks.value ?? []
  const filtered = statusFilter.value
    ? all.filter((t) => t.status === statusFilter.value)
    : [...all]
  const dir = order.value === 'desc' ? -1 : 1

  filtered.sort((a, b) => {
    let cmp = 0
    switch (sortBy.value) {
      case 'priority':
        cmp =
          PRIORITY_RANK[a.priority as TaskPriority] -
          PRIORITY_RANK[b.priority as TaskPriority]
        break
      case 'due_date': {
        const an = a.due_date == null
        const bn = b.due_date == null
        if (an || bn) return an === bn ? tieBreak(a, b) : an ? 1 : -1
        cmp = a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0
        break
      }
      case 'created_at':
        cmp =
          a.created_at < b.created_at
            ? -1
            : a.created_at > b.created_at
              ? 1
              : 0
        break
      default: // 'position'
        cmp = a.position - b.position
    }
    if (cmp === 0) cmp = tieBreak(a, b)
    return cmp * dir
  })
  return filtered
})

// --- List pagination (client-side; the dataset is small, fetched whole) ---
const pageSize = ref(25)
const page = ref(1)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(visibleTasks.value.length / pageSize.value)),
)
const pagedTasks = computed<TaskRead[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return visibleTasks.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() =>
  visibleTasks.value.length === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
)
const pageEnd = computed(() =>
  Math.min(page.value * pageSize.value, visibleTasks.value.length),
)
// Reset to the first page when the filter/sort/size changes; clamp if pages shrink.
watch([pageSize, statusFilter, sortBy, order], () => {
  page.value = 1
})
watch(totalPages, (tp) => {
  if (page.value > tp) page.value = tp
})

// --- Board view: tasks grouped into status columns. ---
const board = reactive<Record<TaskStatus, TaskRead[]>>({
  todo: [],
  in_progress: [],
  done: [],
})

function syncBoard() {
  const groups: Record<TaskStatus, TaskRead[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const task of tasks.value ?? []) {
    groups[task.status as TaskStatus].push(task)
  }
  for (const { value } of STATUSES) {
    groups[value].sort(tieBreak)
    board[value] = groups[value]
  }
}

watch(tasks, syncBoard, { immediate: true })
watch(view, (v) => {
  if (v === 'board') syncBoard()
})

// --- Drag-and-drop persistence ---
let dragSnapshot: Record<TaskStatus, TaskRead[]> | null = null

function onDragStart() {
  dragSnapshot = {
    todo: [...board.todo],
    in_progress: [...board.in_progress],
    done: [...board.done],
  }
}
function restoreSnapshot() {
  if (!dragSnapshot) return
  board.todo = dragSnapshot.todo
  board.in_progress = dragSnapshot.in_progress
  board.done = dragSnapshot.done
}
async function persistColumn(column: TaskStatus) {
  const orderedIds = board[column].map((t) => t.id)
  const { data, error: reorderError } = await supabase.rpc('reorder_tasks', {
    p_status: column,
    p_ordered_ids: orderedIds,
  })
  if (reorderError || !data) {
    restoreSnapshot()
    pushToast('Could not save the new order — reverted.')
    return
  }
  const byId = new Map(data.map((t) => [t.id, t] as const))
  for (const task of tasks.value ?? []) {
    const updated = byId.get(task.id)
    if (updated) Object.assign(task, updated)
  }
}

// --- Task drawer (create + edit) ---
const drawerOpen = ref(false)
const drawerTask = ref<TaskRead | null>(null)

function openCreate() {
  drawerTask.value = null
  drawerOpen.value = true
}
function openEdit(task: TaskRead) {
  drawerTask.value = task
  drawerOpen.value = true
}
async function onDrawerSaved() {
  // reload so the board/list and sidebar counts reflect the create/edit
  await Promise.all([refresh(), refreshCounts()])
}

// Keyboard shortcut: "n" opens the create drawer, unless typing in a field.
function onGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) {
    return
  }
  const el = event.target as HTMLElement | null
  if (
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  ) {
    return
  }
  event.preventDefault()
  openCreate()
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))

// --- Delete (TaskCard confirms + calls the API, then tells us the id) ---
function onTaskDeleted(id: number) {
  if (tasks.value) {
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }
  refreshCounts()
}

// --- Export / import (Excel .xlsx backup) ---
// The file is a spreadsheet, but the transport is still the JSON-based
// export_data/import_data RPCs; utils/backupExcel translates between them.
const importInput = ref<HTMLInputElement | null>(null)
const exporting = ref(false)
const importing = ref(false)

async function exportData() {
  if (exporting.value) return
  exporting.value = true
  const { data, error: exportError } = await supabase.rpc('export_data')
  if (exportError || !data) {
    exporting.value = false
    pushToast('Export failed.')
    return
  }
  try {
    await downloadExcelBackup(data)
    pushToast('Backup downloaded.', 'success')
  } catch {
    pushToast('Could not build the Excel file.')
  } finally {
    exporting.value = false
  }
}

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (
    !confirm(
      'Import REPLACES all current projects, tags, and tasks with the ' +
        'contents of this file. This cannot be undone. Continue?',
    )
  ) {
    return
  }

  importing.value = true
  let parsed: ImportDocument
  try {
    parsed = await parseExcelBackup(file)
  } catch {
    importing.value = false
    pushToast('That file isn’t a readable Excel backup.')
    return
  }

  const { data, error: importError } = await supabase.rpc('import_data', {
    p_payload: parsed,
  })
  importing.value = false
  if (importError || !data) {
    pushToast(
      importError?.message.includes('unsupported export version')
        ? 'Import rejected: unsupported or invalid backup file.'
        : 'Import failed.',
    )
    return
  }

  pushToast(
    `Imported ${data.projects} projects, ${data.tags} tags, ${data.tasks} tasks.`,
    'success',
  )
  projectFilter.value = null
  tagFilter.value = null
  await Promise.all([refresh(), refreshProjects(), refreshTags(), refreshCounts()])
}
</script>

<template>
  <div class="app">
    <AppHeader
      v-model:view="view"
      @select-task="openEdit"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
    />

    <div class="app-body">
      <div class="sidebar-wrap" :class="{ open: sidebarOpen }">
        <AppSidebar
          v-model:project-filter="projectFilter"
          v-model:tag-filter="tagFilter"
          :projects="projects ?? []"
          :tags="tags ?? []"
          :counts="sidebarCounts ?? { all: 0, unassigned: 0, projects: {}, tags: {} }"
          @refresh-projects="refreshProjects"
          @refresh-tags="refreshTags"
          @refresh-tasks="() => { refresh(); refreshCounts() }"
          @navigate="sidebarOpen = false"
        />
      </div>
      <div
        v-if="sidebarOpen"
        class="sidebar-scrim"
        @click="sidebarOpen = false"
      />

      <main class="app-main">
        <div class="action-bar">
          <div v-if="view === 'list' && taskCount > 0" class="toolbar">
            <label>
              <span class="eyebrow">Status</span>
              <select v-model="statusFilter">
                <option value="">All</option>
                <option v-for="s in STATUSES" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
            </label>
            <label>
              <span class="eyebrow">Sort</span>
              <select v-model="sortBy">
                <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </label>
            <label>
              <span class="eyebrow">Order</span>
              <select v-model="order">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <div class="action-bar-right">
            <div class="backup-actions" role="group" aria-label="Excel backup">
              <button
                type="button"
                class="btn btn-sm backup-btn"
                :disabled="exporting"
                title="Export all data to an Excel (.xlsx) file"
                @click="exportData"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v10" /><path d="m8 11 4 4 4-4" /><path d="M5 20h14" /></svg>
                {{ exporting ? 'Exporting…' : 'Export' }}
              </button>
              <button
                type="button"
                class="btn btn-sm backup-btn"
                :disabled="importing"
                title="Replace all data from an Excel (.xlsx) backup"
                @click="triggerImport"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V5" /><path d="m8 9 4-4 4 4" /><path d="M5 20h14" /></svg>
                {{ importing ? 'Importing…' : 'Import' }}
              </button>
            </div>

            <span class="action-divider" aria-hidden="true" />

            <button
              type="button"
              class="btn btn-primary add-btn"
              @click="openCreate"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add task
              <kbd class="kbd add-kbd">n</kbd>
            </button>
          </div>
        </div>

        <p v-if="pending" class="state">Loading tasks…</p>

        <div v-else-if="error" class="state state-error">
          <span>Could not load tasks.</span>
          <button class="btn btn-sm" @click="() => refresh()">Retry</button>
        </div>

        <section
          v-else-if="taskCount === 0 && !hasActiveFilter"
          class="empty-hero"
        >
          <div class="empty-mark" aria-hidden="true">◳</div>
          <h2>No tasks yet</h2>
          <p>
            Press <kbd class="kbd">n</kbd> or use
            <strong>Add task</strong> to create your first one.
          </p>
        </section>

        <template v-else>
          <p v-if="taskCount === 0" class="state empty-filtered">
            No tasks match these filters.
          </p>

          <!-- List view -->
          <div v-else-if="view === 'list'" class="list-view">
            <template v-if="visibleTasks.length">
              <div class="table">
                <div class="table-inner">
                  <div class="list-head" role="row">
                    <span class="cell cell-title">Task</span>
                    <span class="cell">Priority</span>
                    <span class="cell">Project</span>
                    <span class="cell">Tags</span>
                    <span class="cell">Due On</span>
                    <span class="cell">Status</span>
                    <span class="cell cell-actions">Actions</span>
                  </div>
                  <div class="list">
                    <TaskCard
                      v-for="task in pagedTasks"
                      :key="task.id"
                      :task="task"
                      :projects="projects ?? []"
                      :tags="tags ?? []"
                      :show-status-controls="true"
                      @edit="openEdit"
                      @deleted="onTaskDeleted"
                    />
                  </div>
                </div>
              </div>

              <div class="pager">
                <span class="pager-info num">
                  {{ pageStart }}–{{ pageEnd }} of {{ visibleTasks.length }}
                </span>
                <div class="pager-right">
                  <label class="page-size">
                    <span class="eyebrow">Per page</span>
                    <select v-model.number="pageSize">
                      <option v-for="n in PAGE_SIZES" :key="n" :value="n">
                        {{ n }}
                      </option>
                    </select>
                  </label>
                  <div v-if="totalPages > 1" class="pager-nav">
                    <button
                      type="button"
                      class="btn btn-sm"
                      :disabled="page <= 1"
                      @click="page--"
                    >
                      Prev
                    </button>
                    <span class="num page-ind">{{ page }} / {{ totalPages }}</span>
                    <button
                      type="button"
                      class="btn btn-sm"
                      :disabled="page >= totalPages"
                      @click="page++"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="state">No tasks match this status.</p>
          </div>

          <!-- Board view -->
          <div v-else class="board">
            <section
              v-for="col in STATUSES"
              :key="col.value"
              class="column"
              :class="`column-${col.value}`"
            >
              <header class="column-head">
                <span class="col-dot" />
                <h2>{{ col.label }}</h2>
                <span class="col-count num">{{ board[col.value].length }}</span>
              </header>

              <ClientOnly>
                <VueDraggable
                  v-model="board[col.value]"
                  group="tasks"
                  :animation="160"
                  handle=".drag-handle"
                  ghost-class="card-ghost"
                  drag-class="card-dragging"
                  class="column-list"
                  @start="onDragStart"
                  @update="() => persistColumn(col.value)"
                  @add="() => persistColumn(col.value)"
                >
                  <TaskCard
                    v-for="task in board[col.value]"
                    :key="task.id"
                    :task="task"
                    :projects="projects ?? []"
                    :tags="tags ?? []"
                    :draggable="true"
                    @edit="openEdit"
                    @deleted="onTaskDeleted"
                  />
                </VueDraggable>
                <template #fallback>
                  <div class="column-list" />
                </template>
              </ClientOnly>

              <p v-if="!board[col.value].length" class="column-empty">
                Drop tasks here
              </p>
            </section>
          </div>
        </template>
      </main>
    </div>

    <TaskDrawer
      v-model:open="drawerOpen"
      :task="drawerTask"
      :projects="projects ?? []"
      :tags="tags ?? []"
      @saved="onDrawerSaved"
    />

    <input
      ref="importInput"
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="hidden-file"
      @change="onImportFile"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-body {
  display: flex;
  align-items: flex-start;
  flex: 1;
}

.sidebar-wrap {
  position: sticky;
  top: 52px;
  align-self: stretch;
  height: calc(100vh - 52px);
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
  flex-shrink: 0;
}
.sidebar-scrim {
  display: none;
}

.app-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: var(--s6) var(--s6) 5rem;
}

/* Action bar: list filters on the left, Add task pinned to the right. */
.action-bar {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--s4) var(--s5);
  margin-bottom: var(--s5);
}
.action-bar-right {
  display: flex;
  align-items: center;
  gap: var(--s3);
  flex-shrink: 0;
}
.add-btn {
  gap: 0.4rem;
  flex-shrink: 0;
}
.add-kbd {
  background: color-mix(in srgb, var(--on-ink) 18%, transparent);
  border-color: transparent;
  color: var(--on-ink);
}

/* Excel export / import: quiet, on-brand secondary buttons. The icons inherit
   currentColor (muted) — no decorative colour — so the primary Add task stays
   the only emphasised action. A divider sets these utilities apart from it. */
.backup-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}
.backup-btn {
  gap: 0.35rem;
  height: 32px;
  color: var(--text-muted);
}
.backup-btn:hover:not(:disabled) {
  color: var(--text);
}
.backup-btn svg {
  flex-shrink: 0;
}
.action-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
}

/* List filters */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s5);
}
.toolbar label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.toolbar select {
  min-width: 150px;
}

/* List rendered as a table: a header row + rows that share --list-grid. */
.table {
  overflow-x: auto;
}
.table-inner {
  min-width: 880px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.list-head {
  display: grid;
  grid-template-columns: var(--list-grid);
  align-items: center;
  gap: var(--s3);
  padding: 0.45rem var(--s4);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.list-head .cell {
  min-width: 0;
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}
.list-head .cell-actions {
  text-align: right;
  justify-self: end;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
}

/* Pagination */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s4);
}
.pager-info {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
.pager-right {
  display: flex;
  align-items: center;
  gap: var(--s5);
}
.page-size {
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.page-size select {
  width: auto;
  min-width: 64px;
}
.pager-nav {
  display: flex;
  align-items: center;
  gap: var(--s3);
}
.page-ind {
  font-size: var(--fs-xs);
  color: var(--text-muted);
}

/* Board */
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s5);
  align-items: start;
}
.column {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--s3);
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}
.column-head {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: 0.2rem 0.3rem;
}
.column-head h2 {
  font-size: var(--fs-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  flex: 1;
}
.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.column-todo .col-dot {
  background: var(--status-todo);
}
.column-in_progress .col-dot {
  background: var(--status-in_progress);
}
.column-done .col-dot {
  background: var(--status-done);
}
.col-count {
  font-size: var(--fs-xs);
  color: var(--text-faint);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  min-width: 1.5rem;
  text-align: center;
  padding: 0.1rem 0.4rem;
}
.column-list {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-height: 24px;
}
.column-empty {
  margin: 0;
  padding: var(--s5) var(--s3);
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--text-faint);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}

/* States */
.state {
  margin: var(--s5) 0 0;
  color: var(--text-muted);
  font-size: var(--fs-base);
}
.state-error {
  display: flex;
  align-items: center;
  gap: var(--s4);
}
.empty-filtered {
  padding: var(--s6);
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}
.empty-hero {
  margin-top: var(--s7);
  padding: 3.5rem 1.5rem;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.empty-mark {
  font-size: 2.5rem;
  color: var(--text-faint);
  line-height: 1;
}
.empty-hero h2 {
  margin: var(--s4) 0 var(--s2);
  font-size: var(--fs-lg);
}
.empty-hero p {
  margin: 0;
  color: var(--text-muted);
}

.hidden-file {
  display: none;
}

@media (max-width: 980px) {
  .board {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 820px) {
  .sidebar-wrap {
    position: fixed;
    top: 52px;
    left: 0;
    bottom: 0;
    height: auto;
    width: 264px;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-lg);
  }
  .sidebar-wrap.open {
    transform: translateX(0);
  }
  .sidebar-scrim {
    display: block;
    position: fixed;
    inset: 52px 0 0;
    z-index: 55;
    background: rgba(8, 10, 14, 0.45);
  }
  .app-main {
    padding: var(--s5) var(--s4) 4rem;
  }
}
</style>
