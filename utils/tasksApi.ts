import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Task, TaskRow } from '~/types/supabase'

/** select() fragment that embeds each task's tag links alongside its columns. */
export const TASK_SELECT = '*, task_tags(tag_id)'

type TaskWithTagLinks = TaskRow & { task_tags: { tag_id: number }[] }

/** Flattens the embedded `task_tags` rows into `tag_ids`, mirroring the old
 * `TaskRead.tag_ids` (a flat list, no nested tag objects). */
export function mapTask(row: TaskWithTagLinks): Task {
  const { task_tags, ...task } = row
  return { ...task, tag_ids: task_tags.map((t) => t.tag_id) }
}

/** Replace-semantics tag update for one task — mirrors `PUT /tasks/{id}/tags`:
 * the task's tags become exactly `tagIds` (idempotent; one call adds + removes). */
export async function setTaskTags(
  supabase: SupabaseClient<Database>,
  taskId: number,
  tagIds: number[],
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase
    .from('task_tags')
    .delete()
    .eq('task_id', taskId)
  if (delErr) return { error: delErr }

  if (tagIds.length === 0) return { error: null }

  const { error: insErr } = await supabase
    .from('task_tags')
    .insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id })))
  return { error: insErr }
}

/** Escapes a value for use inside a PostgREST `.or()` filter list: wraps it in
 * double quotes so commas/parentheses in the value don't break the filter
 * syntax (per PostgREST's filter escaping rules). */
function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Case-insensitive substring match on title OR description, mirroring the old
 * `GET /tasks?q=`. */
export function searchFilter(term: string): string {
  const pattern = escapeOrValue(`%${term}%`)
  return `title.ilike.${pattern},description.ilike.${pattern}`
}
