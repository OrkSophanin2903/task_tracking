<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import {
  PRIORITIES,
  type ProjectRead,
  type TagRead,
  type TaskPriority,
  type TaskRead,
} from '~/utils/taskMeta'
import { setTaskTags } from '~/utils/tasksApi'

const props = defineProps<{
  task?: TaskRead | null // null/undefined = create mode
  projects: ProjectRead[]
  tags: TagRead[]
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [task: TaskRead] }>()

const supabase = useSupabase()
const { push: pushToast } = useToasts()

const isEdit = ref(false)
const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const dueDate = ref('')
const projectId = ref<number | null>(null)
const tagIds = ref<number[]>([])
const saving = ref(false)
const formError = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

// Populate the form whenever the drawer opens.
watch(open, (isOpen) => {
  if (!isOpen) return
  const t = props.task
  isEdit.value = !!t
  title.value = t?.title ?? ''
  description.value = t?.description ?? ''
  priority.value = (t?.priority as TaskPriority) ?? 'medium'
  dueDate.value = t?.due_date ?? ''
  projectId.value = t?.project_id ?? null
  tagIds.value = t ? [...t.tag_ids] : []
  formError.value = null
  nextTick(() => titleInput.value?.focus())
})

function toggleTag(id: number) {
  tagIds.value = tagIds.value.includes(id)
    ? tagIds.value.filter((t) => t !== id)
    : [...tagIds.value, id]
}

function chipStyle(tag: TagRead): Record<string, string> | undefined {
  return tag.color
    ? { background: tag.color, color: '#fff', borderColor: tag.color }
    : undefined
}

function close() {
  open.value = false
}

async function submit() {
  const trimmed = title.value.trim()
  if (!trimmed) {
    formError.value = 'Title is required.'
    return
  }
  saving.value = true
  formError.value = null

  if (isEdit.value && props.task) {
    const id = props.task.id
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: trimmed,
        description: description.value.trim() || null,
        priority: priority.value,
        due_date: dueDate.value || null,
        project_id: projectId.value,
      })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) {
      saving.value = false
      pushToast('Failed to save changes.')
      return
    }
    let resultTagIds = props.task.tag_ids
    const before = [...props.task.tag_ids].sort((a, b) => a - b)
    const after = [...tagIds.value].sort((a, b) => a - b)
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const { error: tagError } = await setTaskTags(supabase, id, tagIds.value)
      if (tagError) {
        saving.value = false
        pushToast('Saved fields, but failed to update tags.')
        emit('saved', { ...data, tag_ids: resultTagIds })
        close()
        return
      }
      resultTagIds = tagIds.value
    }
    saving.value = false
    emit('saved', { ...data, tag_ids: resultTagIds })
    close()
    return
  }

  // --- Create ---
  const { data: created, error: createError } = await supabase
    .from('tasks')
    .insert({ title: trimmed, description: description.value.trim() || null })
    .select()
    .single()
  if (createError || !created) {
    saving.value = false
    pushToast('Failed to create task.')
    return
  }
  const id = created.id
  let result = { ...created, tag_ids: [] as number[] }

  const needsPatch =
    priority.value !== 'medium' || !!dueDate.value || projectId.value !== null
  if (needsPatch) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        priority: priority.value,
        due_date: dueDate.value || null,
        project_id: projectId.value,
      })
      .eq('id', id)
      .select()
      .single()
    if (data) result = { ...data, tag_ids: result.tag_ids }
    else if (error) pushToast('Task created, but some fields failed to save.')
  }
  if (tagIds.value.length) {
    const { error } = await setTaskTags(supabase, id, tagIds.value)
    if (!error) result.tag_ids = tagIds.value
    else pushToast('Task created, but tags failed to save.')
  }
  saving.value = false
  emit('saved', result)
  close()
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="drawer-root">
      <div class="drawer-backdrop" @click="close" />
      <aside
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? 'Edit task' : 'New task'"
        @keydown.esc="close"
      >
        <header class="drawer-head">
          <h2>{{ isEdit ? 'Edit task' : 'New task' }}</h2>
          <button
            type="button"
            class="btn btn-icon btn-ghost"
            aria-label="Close"
            @click="close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <form class="drawer-body" @submit.prevent="submit">
          <label class="field">
            <span class="eyebrow">Title</span>
            <input
              ref="titleInput"
              v-model="title"
              placeholder="What needs doing?"
              required
            />
          </label>

          <label class="field">
            <span class="eyebrow">Description</span>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Add detail (optional)"
            />
          </label>

          <div class="field-row">
            <label class="field">
              <span class="eyebrow">Priority</span>
              <select v-model="priority">
                <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">
                  {{ p.label }}
                </option>
              </select>
            </label>
            <label class="field">
              <span class="eyebrow">Due date</span>
              <input v-model="dueDate" type="date" />
            </label>
          </div>

          <label class="field">
            <span class="eyebrow">Project</span>
            <select v-model="projectId">
              <option :value="null">No project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </label>

          <div class="field">
            <span class="eyebrow">Tags</span>
            <div v-if="tags.length" class="tag-toggles">
              <button
                v-for="t in tags"
                :key="t.id"
                type="button"
                class="tag-toggle"
                :class="{ active: tagIds.includes(t.id) }"
                :style="tagIds.includes(t.id) ? chipStyle(t) : undefined"
                :aria-pressed="tagIds.includes(t.id)"
                @click="toggleTag(t.id)"
              >
                {{ t.name }}
              </button>
            </div>
            <span v-else class="muted-hint">No tags yet — create some in the sidebar.</span>
          </div>

          <p v-if="formError" class="error">{{ formError }}</p>
        </form>

        <footer class="drawer-foot">
          <button type="button" class="btn btn-ghost" @click="close">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving || !title.trim()"
            @click="submit"
          >
            {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task' }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 100;
}
.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 10, 14, 0.5);
}
.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(440px, 100vw);
  background: var(--surface);
  border-left: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s4) var(--s5);
  border-bottom: 1px solid var(--border);
}
.drawer-head h2 {
  font-size: var(--fs-lg);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--s5);
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}
textarea {
  resize: vertical;
  min-height: 64px;
}
.tag-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}
.tag-toggle {
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  cursor: pointer;
}
.tag-toggle.active {
  border-color: transparent;
}
.muted-hint {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}

.drawer-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-top: 1px solid var(--border);
}

/* Transition: backdrop fades, panel slides in from the right. */
.drawer-enter-active .drawer-backdrop,
.drawer-leave-active .drawer-backdrop {
  transition: opacity 0.2s ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.22s ease;
}
.drawer-enter-from .drawer-backdrop,
.drawer-leave-to .drawer-backdrop {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
