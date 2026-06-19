// Excel (.xlsx) serialisation for the backup export/import.
//
// The on-the-wire format stays JSON — the `export_data` / `import_data`
// Postgres RPCs are untouched — this module only translates between that
// JSON (ExportDocument / ImportDocument) and a spreadsheet workbook so the
// file a user downloads / picks is an .xlsx. SheetJS is heavy, so it's
// dynamically imported here (both entry points are user-triggered clicks),
// keeping it out of the main bundle and off the server.

import type {
  ExportDocument,
  ExportProject,
  ExportTag,
  ExportTask,
  ImportDocument,
} from '~/types/supabase'

// Sheet names + the version we write when none is found on import.
const META_SHEET = 'Meta'
const PROJECTS_SHEET = 'Projects'
const TAGS_SHEET = 'Tags'
const TASKS_SHEET = 'Tasks'
const DEFAULT_VERSION = '1'

// --- small coercion helpers (Excel cells come back loosely typed) ---
function toInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}
function toIntOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
function toStrOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}
function toDateOrNull(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  return s === '' ? null : s
}
function parseTagIds(value: unknown): number[] {
  if (value == null || value === '') return []
  return String(value)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n))
}

// --- Export: ExportDocument JSON → downloaded .xlsx ---
export async function downloadExcelBackup(doc: ExportDocument): Promise<void> {
  const XLSX = await import('xlsx')

  const meta = XLSX.utils.json_to_sheet(
    [
      { key: 'version', value: doc.version },
      { key: 'exported_at', value: doc.exported_at },
    ],
    { header: ['key', 'value'] },
  )

  const projects = XLSX.utils.json_to_sheet(
    doc.projects.map((p) => ({ id: p.id, name: p.name, color: p.color ?? '' })),
    { header: ['id', 'name', 'color'] },
  )

  const tags = XLSX.utils.json_to_sheet(
    doc.tags.map((t) => ({ id: t.id, name: t.name, color: t.color ?? '' })),
    { header: ['id', 'name', 'color'] },
  )

  const tasks = XLSX.utils.json_to_sheet(
    doc.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      priority: t.priority,
      due_date: t.due_date ?? '',
      position: t.position,
      project_id: t.project_id ?? '',
      tag_ids: t.tag_ids.join(','),
    })),
    {
      header: [
        'id',
        'title',
        'description',
        'status',
        'priority',
        'due_date',
        'position',
        'project_id',
        'tag_ids',
      ],
    },
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, meta, META_SHEET)
  XLSX.utils.book_append_sheet(wb, projects, PROJECTS_SHEET)
  XLSX.utils.book_append_sheet(wb, tags, TAGS_SHEET)
  XLSX.utils.book_append_sheet(wb, tasks, TASKS_SHEET)

  const filename = `tasktracker-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

// --- Import: picked .xlsx → ImportDocument JSON (fed to import_data RPC) ---
export async function parseExcelBackup(file: File): Promise<ImportDocument> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })

  const rowsOf = (name: string): Record<string, unknown>[] => {
    const sheet = wb.Sheets[name]
    if (!sheet) return []
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    })
  }

  // Version lives in the Meta sheet; fall back so hand-built sheets still import.
  let version = DEFAULT_VERSION
  const metaRow = rowsOf(META_SHEET).find((r) => r.key === 'version')
  if (metaRow != null && metaRow.value != null && metaRow.value !== '') {
    version = String(metaRow.value)
  }

  const projects: ExportProject[] = rowsOf(PROJECTS_SHEET).map((r) => ({
    id: toInt(r.id),
    name: String(r.name ?? '').trim(),
    color: toStrOrNull(r.color),
  }))

  const tags: ExportTag[] = rowsOf(TAGS_SHEET).map((r) => ({
    id: toInt(r.id),
    name: String(r.name ?? '').trim(),
    color: toStrOrNull(r.color),
  }))

  const tasks: ExportTask[] = rowsOf(TASKS_SHEET).map((r) => ({
    id: toInt(r.id),
    title: String(r.title ?? '').trim(),
    description: toStrOrNull(r.description),
    status: String(r.status ?? 'todo').trim(),
    priority: String(r.priority ?? 'medium').trim(),
    due_date: toDateOrNull(r.due_date),
    position: toInt(r.position),
    project_id: toIntOrNull(r.project_id),
    tag_ids: parseTagIds(r.tag_ids),
  }))

  return { version, projects, tags, tasks }
}
