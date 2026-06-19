<script setup lang="ts">
import { ref } from 'vue'
import type { TagRead } from '~/utils/taskMeta'

defineProps<{ tags: TagRead[] }>()

const emit = defineEmits<{
  'refresh-tags': []
  'refresh-tasks': []
}>()

const supabase = useSupabase()
const { push: pushToast } = useToasts()
const panelError = ref<string | null>(null) // inline: field validation only

// --- Create ---
const newName = ref('')
const newColor = ref('#6b7280')
const creating = ref(false)
const newNameInput = ref<HTMLInputElement | null>(null)

defineExpose({
  focusCreate() {
    newNameInput.value?.focus()
  },
})

const UNIQUE_VIOLATION = '23505'

async function createTag() {
  if (!newName.value.trim()) return
  creating.value = true
  panelError.value = null
  const { error } = await supabase
    .from('tags')
    .insert({ name: newName.value.trim(), color: newColor.value || null })
  creating.value = false
  if (error) {
    pushToast(
      error.code === UNIQUE_VIOLATION
        ? 'A tag with that name already exists.'
        : 'Failed to create tag.',
    )
    return
  }
  newName.value = ''
  emit('refresh-tags')
}

// --- Rename (inline) ---
const editingId = ref<number | null>(null)
const editName = ref('')
const editColor = ref('#6b7280')
const savingId = ref<number | null>(null)

function startEdit(tag: TagRead) {
  editingId.value = tag.id
  editName.value = tag.name
  editColor.value = tag.color ?? '#6b7280'
  panelError.value = null
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(tag: TagRead) {
  if (!editName.value.trim()) {
    panelError.value = 'Name is required.'
    return
  }
  savingId.value = tag.id
  panelError.value = null
  const { error } = await supabase
    .from('tags')
    .update({ name: editName.value.trim(), color: editColor.value || null })
    .eq('id', tag.id)
  savingId.value = null
  if (error) {
    pushToast(
      error.code === UNIQUE_VIOLATION
        ? 'A tag with that name already exists.'
        : 'Failed to save tag.',
    )
    return
  }
  editingId.value = null
  emit('refresh-tags')
  emit('refresh-tasks') // chip labels/colours on cards may have changed
}

// --- Delete ---
const deletingId = ref<number | null>(null)

async function deleteTag(tag: TagRead) {
  if (
    !confirm(
      `Delete tag "${tag.name}"? Tasks keep existing — they just lose this tag.`,
    )
  ) {
    return
  }
  deletingId.value = tag.id
  panelError.value = null
  const { error } = await supabase.from('tags').delete().eq('id', tag.id)
  deletingId.value = null
  if (error) {
    pushToast('Could not delete tag.')
    return
  }
  emit('refresh-tags')
  emit('refresh-tasks') // associations were removed
}
</script>

<template>
  <section class="tags-panel">
    <form class="tag-create" @submit.prevent="createTag">
      <input
        ref="newNameInput"
        v-model="newName"
        class="name-input"
        placeholder="New tag name"
        required
      />
      <input v-model="newColor" type="color" class="color-input" title="Colour" />
      <button
        type="submit"
        class="btn btn-sm btn-primary"
        :disabled="creating || !newName.trim()"
      >
        {{ creating ? 'Adding…' : 'Add tag' }}
      </button>
    </form>

    <p v-if="panelError" class="error">{{ panelError }}</p>

    <ul v-if="tags.length" class="tag-list">
      <li v-for="tag in tags" :key="tag.id" class="tag-item">
        <template v-if="editingId === tag.id">
          <input v-model="editColor" type="color" class="color-input" />
          <input
            v-model="editName"
            class="name-input"
            placeholder="Tag name"
            @keyup.enter="saveEdit(tag)"
            @keyup.esc="cancelEdit"
          />
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="savingId === tag.id || !editName.trim()"
            @click="saveEdit(tag)"
          >
            Save
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="cancelEdit">
            Cancel
          </button>
        </template>
        <template v-else>
          <span
            class="chip"
            :style="
              tag.color
                ? { background: tag.color, color: '#fff', borderColor: tag.color }
                : undefined
            "
          >
            {{ tag.name }}
          </span>
          <span class="spacer" />
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="startEdit(tag)"
          >
            Rename
          </button>
          <button
            type="button"
            class="btn btn-sm btn-danger"
            :disabled="deletingId === tag.id"
            @click="deleteTag(tag)"
          >
            {{ deletingId === tag.id ? 'Deleting…' : 'Delete' }}
          </button>
        </template>
      </li>
    </ul>
    <p v-else class="empty-note">No tags yet — add one above.</p>
  </section>
</template>

<style scoped>
.tags-panel {
  border-top: 1px solid var(--border);
  padding: var(--s3) var(--s2) 0;
}
.tag-create {
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
.tag-list {
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.tag-item {
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: 0.22rem 0.3rem;
  border-radius: var(--radius-sm);
}
.tag-item:hover {
  background: var(--surface-3);
}
.spacer {
  flex: 1;
}
.chip {
  display: inline-flex;
  align-items: center;
  font-size: var(--fs-2xs);
  font-weight: 600;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  color: var(--text);
}
.empty-note {
  margin: var(--s3) 0 0;
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
</style>
