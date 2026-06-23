<script setup lang="ts">
import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  PRIORITIES,
  STATUSES,
  isOverdue,
  type ProjectRead,
  type TagRead,
  type TaskRead,
  type TaskStatus,
} from '~/utils/taskMeta'
import { TASK_SELECT, mapTask } from '~/utils/tasksApi'

const supabase = useSupabase()
const { push: pushToast } = useToasts()
const { palette } = useChartTheme()

// --- Data: the whole dataset, aggregated client-side into summaries. ---
const {
  data: tasks,
  error: tasksError,
  refresh: refreshTasks,
} = await useAsyncData<TaskRead[]>('dash-tasks', async () => {
  const { data, error } = await supabase.from('tasks').select(TASK_SELECT)
  if (error || !data) throw new Error('Failed to load tasks')
  return data.map(mapTask)
})
const {
  data: projects,
  error: projectsError,
  refresh: refreshProjects,
} = await useAsyncData<ProjectRead[]>('dash-projects', async () => {
  const { data, error } = await supabase.from('projects').select('*').order('id')
  if (error || !data) throw new Error('Failed to load projects')
  return data
})
const {
  data: tags,
  error: tagsError,
  refresh: refreshTags,
} = await useAsyncData<TagRead[]>('dash-tags', async () => {
  const { data, error } = await supabase.from('tags').select('*').order('name')
  if (error || !data) throw new Error('Failed to load tags')
  return data
})

// --- Refresh (manual + on-focus; no polling) + a relabelling "updated … ago" ---
const refreshing = ref(false)
const lastUpdated = ref(Date.now())
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  await Promise.all([refreshTasks(), refreshProjects(), refreshTags()])
  refreshing.value = false
  if (tasksError.value || projectsError.value || tagsError.value) {
    pushToast('Could not refresh some dashboard data.')
    return
  }
  lastUpdated.value = Date.now()
}

const updatedLabel = computed(() => {
  const secs = Math.max(0, Math.round((now.value - lastUpdated.value) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
})

function onVisible() {
  if (document.visibilityState === 'visible') refreshAll()
}
onMounted(() => {
  window.addEventListener('focus', refreshAll)
  document.addEventListener('visibilitychange', onVisible)
  ticker = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshAll)
  document.removeEventListener('visibilitychange', onVisible)
  if (ticker) clearInterval(ticker)
})

// --- Derived stats ---
const allTasks = computed(() => tasks.value ?? [])
const total = computed(() => allTasks.value.length)

const byStatus = computed(() => {
  const c: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
  for (const t of allTasks.value) c[t.status as TaskStatus]++
  return c
})
const completionRate = computed(() =>
  total.value === 0 ? 0 : Math.round((byStatus.value.done / total.value) * 100),
)

const todayIso = new Date().toISOString().slice(0, 10)
const weekIso = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
})()
const overdueCount = computed(() => allTasks.value.filter(isOverdue).length)
const dueTodayCount = computed(
  () =>
    allTasks.value.filter(
      (t) => t.status !== 'done' && t.due_date === todayIso,
    ).length,
)
const dueWeekCount = computed(
  () =>
    allTasks.value.filter(
      (t) =>
        t.status !== 'done' &&
        t.due_date != null &&
        t.due_date >= todayIso &&
        t.due_date <= weekIso,
    ).length,
)
const unscheduledCount = computed(
  () =>
    allTasks.value.filter((t) => t.status !== 'done' && t.due_date == null)
      .length,
)

const byPriority = computed(() => {
  const c = { high: 0, medium: 0, low: 0 }
  for (const t of allTasks.value) {
    if (t.priority === 'high' || t.priority === 'medium' || t.priority === 'low')
      c[t.priority]++
  }
  return c
})

const projectStats = computed(() => {
  const counts = new Map<number | null, number>()
  for (const t of allTasks.value) {
    counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1)
  }
  const rows = (projects.value ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    count: counts.get(p.id) ?? 0,
  }))
  return { rows, unassigned: counts.get(null) ?? 0 }
})

// Snapshot completion (done / total) per project, incl. an Unassigned bucket.
// Least-complete first, so the work that needs attention floats to the top.
const projectCompletion = computed(() => {
  const tot = new Map<number | null, number>()
  const done = new Map<number | null, number>()
  for (const t of allTasks.value) {
    tot.set(t.project_id, (tot.get(t.project_id) ?? 0) + 1)
    if (t.status === 'done')
      done.set(t.project_id, (done.get(t.project_id) ?? 0) + 1)
  }
  const row = (id: number | null, name: string, color: string | null) => {
    const total = tot.get(id) ?? 0
    const d = done.get(id) ?? 0
    return { id, name, color, total, done: d, rate: total ? Math.round((d / total) * 100) : 0 }
  }
  const rows = (projects.value ?? []).map((p) => row(p.id, p.name, p.color))
  if ((tot.get(null) ?? 0) > 0) rows.push(row(null, 'Unassigned', null))
  return rows.filter((r) => r.total > 0).sort((a, b) => a.rate - b.rate)
})

const tagStats = computed(() => {
  const counts = new Map<number, number>()
  for (const t of allTasks.value) {
    for (const id of t.tag_ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return (tags.value ?? [])
    .map((tg) => ({
      id: tg.id,
      name: tg.name,
      color: tg.color,
      count: counts.get(tg.id) ?? 0,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
})

// --- Legend helpers ---
function statusColor(s: TaskStatus): string {
  const p = palette.value
  if (!p) return 'transparent'
  return p.status[s]
}

// --- Chart data + options (recompute when the palette/theme changes) ---
const statusChartData = computed<ChartData<'doughnut'>>(() => {
  const p = palette.value
  return {
    labels: STATUSES.map((s) => s.label),
    datasets: [
      {
        data: [byStatus.value.todo, byStatus.value.in_progress, byStatus.value.done],
        backgroundColor: p
          ? [p.status.todo, p.status.in_progress, p.status.done]
          : [],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }
})
// Draws each slice's share (%) centred on its arc. Scoped to the status
// doughnut via the <Doughnut :plugins> prop, so the bar charts are unaffected.
const arcPercentPlugin: Plugin<'doughnut'> = {
  id: 'arcPercent',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    const data = (chart.data.datasets[0]?.data ?? []) as number[]
    const total = data.reduce((sum, v) => sum + (v || 0), 0)
    if (!total) return
    ctx.save()
    ctx.font = '600 12px Geist, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Round joins so the text outline doesn't sprout spikes at sharp corners.
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    meta.data.forEach((arc, i) => {
      const value = data[i] || 0
      if (!value) return
      const pct = Math.round((value / total) * 100)
      const { startAngle, endAngle, innerRadius, outerRadius } = arc.getProps(
        ['startAngle', 'endAngle', 'innerRadius', 'outerRadius'],
        true,
      )
      // Hide the label on very thin slices where it wouldn't fit.
      if (endAngle - startAngle < 0.25) return
      const angle = (startAngle + endAngle) / 2
      const radius = (innerRadius + outerRadius) / 2
      const x = arc.x + Math.cos(angle) * radius
      const y = arc.y + Math.sin(angle) * radius
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillStyle = '#fff'
      ctx.strokeText(`${pct}%`, x, y)
      ctx.fillText(`${pct}%`, x, y)
    })
    ctx.restore()
  },
}

const statusChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '64%',
  plugins: { legend: { display: false } },
  onClick: (_e, els) => {
    if (els.length) navigateTo(`/tasks?status=${STATUSES[els[0].index].value}`)
  },
}))

function barOptions(horizontal: boolean): ChartOptions<'bar'> {
  const p = palette.value
  const valueAxis = { beginAtZero: true, ticks: { color: p?.text, precision: 0 }, grid: { color: p?.grid } }
  const catAxis = { ticks: { color: p?.text }, grid: { display: false } }
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: false } },
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
  }
}

const priorityChartData = computed<ChartData<'bar'>>(() => {
  const p = palette.value
  return {
    labels: PRIORITIES.map((x) => x.label),
    datasets: [
      {
        data: [byPriority.value.high, byPriority.value.medium, byPriority.value.low],
        backgroundColor: p ? [p.priority.high, p.priority.medium, p.priority.low] : [],
        borderRadius: 4,
        maxBarThickness: 56,
      },
    ],
  }
})
const priorityChartOptions = computed<ChartOptions<'bar'>>(() => ({
  ...barOptions(false),
  onClick: (_e, els) => {
    if (els.length) navigateTo(`/tasks?status=&sort=priority&order=asc`)
  },
}))

const projectChartData = computed<ChartData<'bar'>>(() => {
  const p = palette.value
  const rows = projectStats.value.rows
  return {
    labels: [...rows.map((r) => r.name), 'Unassigned'],
    datasets: [
      {
        data: [...rows.map((r) => r.count), projectStats.value.unassigned],
        backgroundColor: [
          ...rows.map((r) => r.color || p?.fallback || '#888'),
          p?.textFaint || '#999',
        ],
        borderRadius: 4,
        maxBarThickness: 26,
      },
    ],
  }
})
const projectChartOptions = computed<ChartOptions<'bar'>>(() => ({
  ...barOptions(true),
  onClick: (_e, els) => {
    if (!els.length) return
    const i = els[0].index
    const rows = projectStats.value.rows
    navigateTo(`/tasks?project=${i < rows.length ? rows[i].id : 0}`)
  },
}))

const tagChartData = computed<ChartData<'bar'>>(() => {
  const p = palette.value
  const rows = tagStats.value
  return {
    labels: rows.map((r) => r.name),
    datasets: [
      {
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((r) => r.color || p?.fallback || '#888'),
        borderRadius: 4,
        maxBarThickness: 26,
      },
    ],
  }
})
const tagChartOptions = computed<ChartOptions<'bar'>>(() => ({
  ...barOptions(true),
  onClick: (_e, els) => {
    if (els.length) navigateTo(`/tasks?tag=${tagStats.value[els[0].index].id}`)
  },
}))
</script>

<template>
  <div class="app">
    <AppHeader mode="dashboard" />

    <main class="dash">
      <div class="dash-bar">
        <div>
          <h1 class="dash-title">Dashboard</h1>
          <p class="dash-sub">An overview of your {{ total }} tasks.</p>
        </div>
        <div class="refresh">
          <span class="updated num">Updated {{ updatedLabel }}</span>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="refreshing"
            @click="refreshAll"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <section v-if="total === 0" class="empty-hero">
        <div class="empty-mark" aria-hidden="true">◳</div>
        <h2>No data yet</h2>
        <p>
          Create some tasks and your summary will appear here.
          <NuxtLink to="/tasks" class="empty-link">Go to Tasks →</NuxtLink>
        </p>
      </section>

      <template v-else>
        <!-- KPI: overview -->
        <section class="kpi-group">
          <h2 class="eyebrow group-title">Overview</h2>
          <div class="kpi-grid">
            <StatCard label="Total tasks" :value="total" to="/tasks" />
            <StatCard
              label="To Do"
              :value="byStatus.todo"
              tone="todo"
              to="/tasks?status=todo"
            />
            <StatCard
              label="In Progress"
              :value="byStatus.in_progress"
              tone="in_progress"
              to="/tasks?status=in_progress"
            />
            <StatCard
              label="Done"
              :value="byStatus.done"
              tone="done"
              to="/tasks?status=done"
            />
            <StatCard
              label="Completion"
              :value="`${completionRate}%`"
              tone="accent"
              :sub="`${byStatus.done} of ${total} done`"
            />
          </div>
        </section>

        <!-- KPI: needs attention -->
        <section class="kpi-group">
          <h2 class="eyebrow group-title">Needs attention</h2>
          <div class="kpi-grid">
            <StatCard
              label="Overdue"
              :value="overdueCount"
              tone="overdue"
              to="/tasks?sort=due_date&order=asc"
            />
            <StatCard
              label="Due today"
              :value="dueTodayCount"
              to="/tasks?sort=due_date&order=asc"
            />
            <StatCard
              label="Due this week"
              :value="dueWeekCount"
              to="/tasks?sort=due_date&order=asc"
            />
            <StatCard
              label="Unscheduled"
              :value="unscheduledCount"
              to="/tasks?sort=created_at&order=desc"
            />
          </div>
        </section>

        <!-- Completion report: per-project, snapshot -->
        <section class="report">
          <h2 class="eyebrow group-title">Completion by project</h2>
          <div v-if="projectCompletion.length" class="report-card">
            <NuxtLink
              v-for="r in projectCompletion"
              :key="r.id ?? 'unassigned'"
              class="report-row"
              :to="`/tasks?project=${r.id ?? 0}`"
            >
              <span class="report-name">
                <span
                  class="report-dot"
                  :style="{ background: r.color || 'var(--text-faint)' }"
                />
                {{ r.name }}
              </span>
              <span class="bar" aria-hidden="true">
                <span class="bar-fill" :style="{ width: `${r.rate}%` }" />
              </span>
              <span class="num report-count">{{ r.done }}/{{ r.total }}</span>
              <span class="num report-pct">{{ r.rate }}%</span>
            </NuxtLink>
          </div>
          <p v-else class="chart-empty report-empty">No projects with tasks yet.</p>
        </section>

        <!-- Charts -->
        <section class="chart-grid">
          <div class="chart-card">
            <h3 class="chart-title">By status</h3>
            <div class="chart-box donut-box">
              <ClientOnly>
                <Doughnut
                  v-if="palette"
                  :data="statusChartData"
                  :options="statusChartOptions"
                  :plugins="[arcPercentPlugin]"
                />
              </ClientOnly>
              <div class="donut-center">
                <span class="num donut-total">{{ total }}</span>
                <span class="donut-cap">tasks</span>
              </div>
            </div>
            <ul class="legend">
              <li v-for="s in STATUSES" :key="s.value">
                <span class="legend-dot" :style="{ background: statusColor(s.value) }" />
                {{ s.label }}
                <span class="num legend-num">{{ byStatus[s.value] }}</span>
              </li>
            </ul>
          </div>

          <div class="chart-card">
            <h3 class="chart-title">By priority</h3>
            <div class="chart-box">
              <ClientOnly>
                <Bar
                  v-if="palette"
                  :data="priorityChartData"
                  :options="priorityChartOptions"
                />
              </ClientOnly>
            </div>
          </div>

          <div class="chart-card">
            <h3 class="chart-title">By project</h3>
            <div class="chart-box chart-box-tall">
              <ClientOnly>
                <Bar
                  v-if="palette"
                  :data="projectChartData"
                  :options="projectChartOptions"
                />
              </ClientOnly>
            </div>
          </div>

          <div class="chart-card">
            <h3 class="chart-title">Top tags</h3>
            <div v-if="tagStats.length" class="chart-box chart-box-tall">
              <ClientOnly>
                <Bar
                  v-if="palette"
                  :data="tagChartData"
                  :options="tagChartOptions"
                />
              </ClientOnly>
            </div>
            <p v-else class="chart-empty">No tags in use yet.</p>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.dash {
  flex: 1;
  width: 100%;
  padding: var(--s6) var(--s6) 5rem;
  display: flex;
  flex-direction: column;
  gap: var(--s6);
}

.dash-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s4);
}
.dash-title {
  font-size: var(--fs-xl);
  font-weight: 600;
  letter-spacing: -0.02em;
}
.dash-sub {
  margin: 0.15rem 0 0;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}
.refresh {
  display: flex;
  align-items: center;
  gap: var(--s3);
}
.updated {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}

/* KPI groups */
.kpi-group {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}
.group-title {
  color: var(--text-faint);
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--s4);
}

/* Completion report */
.report {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}
.report-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.report-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) minmax(0, 2fr) auto 3.5rem;
  align-items: center;
  gap: var(--s4);
  padding: var(--s3) var(--s5);
  text-decoration: none;
  color: var(--text);
  font-size: var(--fs-sm);
}
.report-row + .report-row {
  border-top: 1px solid var(--border);
}
.report-row:hover {
  background: var(--surface-2);
}
.report-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-weight: 550;
  overflow: hidden;
  white-space: nowrap;
}
.report-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bar {
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transition: width 0.2s ease;
}
.report-count {
  color: var(--text-muted);
  font-size: var(--fs-xs);
  text-align: right;
}
.report-pct {
  font-weight: 600;
  text-align: right;
}
.report-empty {
  height: auto;
  padding: var(--s5);
}

/* Charts */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s5);
}
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--s5);
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}
.chart-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.chart-box {
  position: relative;
  height: 220px;
}
.chart-box-tall {
  height: 280px;
}

/* Doughnut centre label */
.donut-box {
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.donut-total {
  font-size: 1.8rem;
  font-weight: 600;
  line-height: 1;
}
.donut-cap {
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

/* Legends */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s5);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-num {
  color: var(--text);
  font-weight: 600;
}
.chart-empty {
  margin: 0;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  font-size: var(--fs-sm);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}

/* Empty state */
.empty-hero {
  margin-top: var(--s6);
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
.empty-link {
  color: var(--accent-text);
  font-weight: 550;
  text-decoration: none;
}

@media (max-width: 820px) {
  .dash {
    padding: var(--s5) var(--s4) 4rem;
  }
}
@media (max-width: 760px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
