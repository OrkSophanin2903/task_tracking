<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectRead } from '~/utils/taskMeta'

defineProps<{ projects: ProjectRead[] }>()

// Emitted so the page can refetch. `refresh-tasks` only fires when a delete
// orphaned tasks (their project_id became null server-side).
const emit = defineEmits<{
  'refresh-projects': []
  'refresh-tasks': []
}>()

const supabase = useSupabase()
const { push: pushToast } = useToasts()
const panelError = ref<string | null>(null) // inline: field validation only

// --- Create ---
const newName = ref('')
const newColor = ref('#4f46e5')
const creating = ref(false)
const newNameInput = ref<HTMLInputElement | null>(null)

defineExpose({
  focusCreate() {
    newNameInput.value?.focus()
  },
})

async function createProject() {
  if (!newName.value.trim()) return
  creating.value = true
  panelError.value = null
  const { error } = await supabase
    .from('projects')
    .insert({ name: newName.value.trim(), color: newColor.value || null })
  creating.value = false
  if (error) {
    pushToast('Failed to create project.')
    return
  }
  newName.value = ''
  emit('refresh-projects')
}

// --- Rename (inline) ---
const editingId = ref<number | null>(null)
const editName = ref('')
const editColor = ref<string>('#4f46e5')
const savingId = ref<number | null>(null)

function startEdit(project: ProjectRead) {
  editingId.value = project.id
  editName.value = project.name
  editColor.value = project.color ?? '#4f46e5'
  panelError.value = null
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(project: ProjectRead) {
  if (!editName.value.trim()) {
    panelError.value = 'Name is required.'
    return
  }
  savingId.value = project.id
  panelError.value = null
  const { error } = await supabase
    .from('projects')
    .update({ name: editName.value.trim(), color: editColor.value || null })
    .eq('id', project.id)
  savingId.value = null
  if (error) {
    pushToast('Failed to save project.')
    return
  }
  editingId.value = null
  emit('refresh-projects')
}

// --- Delete ---
const deletingId = ref<number | null>(null)

async function deleteProject(project: ProjectRead) {
  if (
    !confirm(
      `Delete project "${project.name}"? Its tasks will be kept but unassigned.`,
    )
  ) {
    return
  }
  deletingId.value = project.id
  panelError.value = null
  const { error } = await supabase.from('projects').delete().eq('id', project.id)
  deletingId.value = null
  if (error) {
    pushToast('Could not delete project.')
    return
  }
  // Deleting a project nulls project_id on its tasks, so refresh both.
  emit('refresh-projects')
  emit('refresh-tasks')
}
</script>

<template>
  <section class="projects-panel">
    <form class="project-create" @submit.prevent="createProject">
      <input
        ref="newNameInput"
        v-model="newName"
        class="name-input"
        placeholder="New project name"
        required
      />
      <input v-model="newColor" type="color" class="color-input" title="Colour" />
      <button
        type="submit"
        class="btn btn-sm btn-primary"
        :disabled="creating || !newName.trim()"
      >
        {{ creating ? 'Adding…' : 'Add project' }}
      </button>
    </form>

    <p v-if="panelError" class="error">{{ panelError }}</p>

    <ul v-if="projects.length" class="project-list">
      <li v-for="project in projects" :key="project.id" class="project-item">
        <template v-if="editingId === project.id">
          <input v-model="editColor" type="color" class="color-input" />
          <input
            v-model="editName"
            class="name-input"
            placeholder="Project name"
            @keyup.enter="saveEdit(project)"
            @keyup.esc="cancelEdit"
          />
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="savingId === project.id || !editName.trim()"
            @click="saveEdit(project)"
          >
            Save
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="cancelEdit">
            Cancel
          </button>
        </template>
        <template v-else>
          <span
            class="swatch"
            :style="project.color ? { background: project.color } : undefined"
          />
          <span class="project-name">{{ project.name }}</span>
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="startEdit(project)"
          >
            Rename
          </button>
          <button
            type="button"
            class="btn btn-sm btn-danger"
            :disabled="deletingId === project.id"
            @click="deleteProject(project)"
          >
            {{ deletingId === project.id ? 'Deleting…' : 'Delete' }}
          </button>
        </template>
      </li>
    </ul>
    <p v-else class="empty-note">No projects yet — add one above.</p>
  </section>
</template>

<style scoped>
.projects-panel {
  border-top: 1px solid var(--border);
  padding: var(--s3) var(--s2) 0;
}
.project-create {
  display: flex;
  gap: var(--s2);
  align-items: center;
  flex-wrap: wrap;
}
.name-input {
  flex: 1 1 120px;
}
.color-input {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}
.project-list {
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.project-item {
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: 0.22rem 0.3rem;
  border-radius: var(--radius-sm);
}
.project-item:hover {
  background: var(--surface-3);
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--text-faint);
  border: 1px solid var(--border-strong);
  flex-shrink: 0;
}
.project-name {
  flex: 1;
  font-size: var(--fs-sm);
  font-weight: 500;
  word-break: break-word;
}
.empty-note {
  margin: var(--s3) 0 0;
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
</style>
