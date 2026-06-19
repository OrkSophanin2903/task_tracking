import type { Project, Tag, Task } from '~/types/supabase'

// Shared task types + presentation metadata used by the page and TaskCard.
export type TaskRead = Task
export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
export type ProjectRead = Project
export type TagRead = Tag

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// Logical priority ranking (lower = more important), used for client-side
// sorting in the list view (high > medium > low).
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

export function isOverdue(task: TaskRead): boolean {
  return (
    task.due_date != null &&
    task.due_date < todayIso() &&
    task.status !== 'done'
  )
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
