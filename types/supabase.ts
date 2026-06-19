/**
 * Hand-written counterpart to `supabase gen types typescript`, matching
 * supabase/migrations/*.sql. Regenerate with the CLI once the project is
 * linked (`supabase gen types typescript --project-id <ref>`) and this file
 * can be deleted in favour of the generated one.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
        }
        Update: {
          name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: number
          user_id: string
          name: string
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: string
          name: string
          color?: string | null
        }
        Update: {
          name?: string
          color?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: number
          user_id: string
          name: string
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: string
          name: string
          color?: string | null
        }
        Update: {
          name?: string
          color?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: number
          user_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          due_date: string | null
          position: number
          project_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          position?: number
          project_id?: number | null
        }
        Update: {
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          position?: number
          project_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_tasks_project_id_projects'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      task_tags: {
        Row: {
          task_id: number
          tag_id: number
        }
        Insert: {
          task_id: number
          tag_id: number
        }
        Update: {
          task_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'task_tags_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      reorder_tasks: {
        Args: { p_status: string; p_ordered_ids: number[] }
        Returns: Database['public']['Tables']['tasks']['Row'][]
      }
      export_data: {
        Args: Record<PropertyKey, never>
        Returns: ExportDocument
      }
      import_data: {
        Args: { p_payload: ImportDocument }
        Returns: { projects: number; tags: number; tasks: number }
      }
    }
  }
}

// --- Backup document shapes (export_data / import_data RPCs) ---

export interface ExportProject {
  id: number
  name: string
  color: string | null
}

export interface ExportTag {
  id: number
  name: string
  color: string | null
}

export interface ExportTask {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  position: number
  project_id: number | null
  tag_ids: number[]
}

export interface ExportDocument {
  version: string
  exported_at: string
  projects: ExportProject[]
  tags: ExportTag[]
  tasks: ExportTask[]
}

export interface ImportDocument {
  version: string
  projects?: ExportProject[]
  tags?: ExportTag[]
  tasks?: ExportTask[]
}

// --- App-level row types, used throughout components ---

export type Project = Database['public']['Tables']['projects']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type TaskRow = Database['public']['Tables']['tasks']['Row']

/** A task with its tag ids flattened in, mirroring the old `TaskRead.tag_ids`. */
export type Task = TaskRow & { tag_ids: number[] }
