<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ProjectRead, TagRead } from '~/utils/taskMeta'

export interface SidebarCounts {
  all: number
  unassigned: number
  projects: Record<number, number>
  tags: Record<number, number>
}

const props = defineProps<{
  projects: ProjectRead[]
  tags: TagRead[]
  counts: SidebarCounts
}>()

const projectFilter = defineModel<number | null>('projectFilter', {
  required: true,
})
const tagFilter = defineModel<number | null>('tagFilter', { required: true })

const emit = defineEmits<{
  'refresh-projects': []
  'refresh-tags': []
  'refresh-tasks': []
  navigate: []
}>()

const manageProjects = ref(false)
const manageTags = ref(false)
const projectsPanel = ref<{ focusCreate: () => void } | null>(null)
const tagsPanel = ref<{ focusCreate: () => void } | null>(null)

function setProject(value: number | null) {
  projectFilter.value = value
  emit('navigate')
}
function setTag(value: number | null) {
  tagFilter.value = value
  emit('navigate')
}

async function addProject() {
  manageProjects.value = true
  await nextTick()
  projectsPanel.value?.focusCreate()
}
async function addTag() {
  manageTags.value = true
  await nextTick()
  tagsPanel.value?.focusCreate()
}

function projectCount(id: number): number {
  return props.counts.projects[id] ?? 0
}
function tagCount(id: number): number {
  return props.counts.tags[id] ?? 0
}
</script>

<template>
  <aside class="sidebar">
    <!-- Projects -->
    <section class="nav-group">
      <div class="nav-head">
        <span class="eyebrow">Projects</span>
        <div class="nav-head-actions">
          <button
            type="button"
            class="icon-btn"
            aria-label="Add project"
            title="Add project"
            @click="addProject"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button
            type="button"
            class="manage-btn"
            :class="{ on: manageProjects }"
            :aria-pressed="manageProjects"
            @click="manageProjects = !manageProjects"
          >
            {{ manageProjects ? 'Done' : 'Manage' }}
          </button>
        </div>
      </div>

      <nav class="nav-list">
        <button
          type="button"
          class="nav-item"
          :class="{ active: projectFilter === null }"
          @click="setProject(null)"
        >
          <span class="dot dot-all" />
          <span class="nav-label">All tasks</span>
          <span class="count num">{{ counts.all }}</span>
        </button>
        <button
          type="button"
          class="nav-item"
          :class="{ active: projectFilter === 0 }"
          @click="setProject(0)"
        >
          <span class="dot dot-none" />
          <span class="nav-label">Unassigned</span>
          <span class="count num">{{ counts.unassigned }}</span>
        </button>
        <button
          v-for="p in projects"
          :key="p.id"
          type="button"
          class="nav-item"
          :class="{ active: projectFilter === p.id }"
          :title="p.name"
          @click="setProject(p.id)"
        >
          <span
            class="dot"
            :style="p.color ? { background: p.color } : undefined"
          />
          <span class="nav-label">{{ p.name }}</span>
          <span class="count num">{{ projectCount(p.id) }}</span>
        </button>
        <p v-if="!projects.length" class="nav-empty">No projects yet</p>
      </nav>

      <ProjectsPanel
        v-if="manageProjects"
        ref="projectsPanel"
        :projects="projects"
        class="panel"
        @refresh-projects="emit('refresh-projects')"
        @refresh-tasks="emit('refresh-tasks')"
      />
    </section>

    <!-- Tags -->
    <section class="nav-group">
      <div class="nav-head">
        <span class="eyebrow">Tags</span>
        <div class="nav-head-actions">
          <button
            type="button"
            class="icon-btn"
            aria-label="Add tag"
            title="Add tag"
            @click="addTag"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button
            type="button"
            class="manage-btn"
            :class="{ on: manageTags }"
            :aria-pressed="manageTags"
            @click="manageTags = !manageTags"
          >
            {{ manageTags ? 'Done' : 'Manage' }}
          </button>
        </div>
      </div>

      <nav class="nav-list">
        <button
          type="button"
          class="nav-item"
          :class="{ active: tagFilter === null }"
          @click="setTag(null)"
        >
          <span class="hash">#</span>
          <span class="nav-label">All tags</span>
          <span class="count num">{{ counts.all }}</span>
        </button>
        <button
          v-for="t in tags"
          :key="t.id"
          type="button"
          class="nav-item"
          :class="{ active: tagFilter === t.id }"
          :title="t.name"
          @click="setTag(t.id)"
        >
          <span
            class="dot"
            :style="t.color ? { background: t.color } : undefined"
          />
          <span class="nav-label">{{ t.name }}</span>
          <span class="count num">{{ tagCount(t.id) }}</span>
        </button>
        <p v-if="!tags.length" class="nav-empty">No tags yet</p>
      </nav>

      <TagsPanel
        v-if="manageTags"
        ref="tagsPanel"
        :tags="tags"
        class="panel"
        @refresh-tags="emit('refresh-tags')"
        @refresh-tasks="emit('refresh-tasks')"
      />
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--s6);
  padding: var(--s5) var(--s4);
  width: 248px;
  flex-shrink: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}
.nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--s2) var(--s1);
}
.nav-head-actions {
  display: flex;
  align-items: center;
  gap: var(--s1);
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-faint);
  cursor: pointer;
}
.icon-btn:hover {
  color: var(--accent-text);
  background: var(--surface-3);
}
.manage-btn {
  background: transparent;
  border: none;
  color: var(--text-faint);
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.manage-btn:hover,
.manage-btn.on {
  color: var(--accent-text);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  padding: 0.34rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--fs-base);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.nav-item:hover {
  background: var(--surface-2);
  color: var(--text);
}
.nav-item.active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
  color: var(--accent-text);
  font-weight: 550;
}
.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  flex-shrink: 0;
  font-size: var(--fs-2xs);
  color: var(--text-faint);
}
.nav-item.active .count {
  color: var(--accent-text);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06) inset;
}
.dot-all {
  background: var(--text);
}
.dot-none {
  background: transparent;
  border: 1.5px dashed var(--border-strong);
  box-shadow: none;
}
.hash {
  width: 9px;
  text-align: center;
  font-family: var(--font-mono);
  color: var(--text-faint);
  flex-shrink: 0;
}

.nav-empty {
  margin: 0.1rem 0.5rem;
  font-size: var(--fs-xs);
  color: var(--text-faint);
}

.panel {
  margin-top: var(--s2);
}
</style>
