export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      briefs: {
        Row: {
          answers: Json
          completed: boolean
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          answers: Json
          completed?: boolean
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          answers?: Json
          completed?: boolean
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'briefs_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_members_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_members_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      client_onboarding_submissions: {
        Row: {
          budget: string | null
          client_email: string
      client_name: string
      company: string | null
      created_at: string
      goals: string
      gdpr_consent: boolean
      id: string
      integrations: string | null
      invite_client: boolean
      core_features: string
      competitors: Json
      phone: string | null
      project_description: string
      project_due_date: string | null
      project_name: string
      risks: string | null
      success_metrics: string | null
      target_users: string
      timeline: string | null
      timezone: string | null
      website: string | null
        }
        Insert: {
          budget?: string | null
          client_email: string
      client_name: string
      company?: string | null
      created_at?: string
      goals: string
      gdpr_consent?: boolean
      id?: string
      integrations?: string | null
      invite_client?: boolean
      core_features: string
      competitors?: Json
      phone?: string | null
      project_description: string
      project_due_date?: string | null
      project_name: string
          risks?: string | null
          success_metrics?: string | null
          target_users: string
          timeline?: string | null
          timezone?: string | null
          website?: string | null
        }
        Update: {
          budget?: string | null
          client_email?: string
      client_name?: string
      company?: string | null
      created_at?: string
      goals?: string
      gdpr_consent?: boolean
      id?: string
      integrations?: string | null
      invite_client?: boolean
      core_features?: string
      competitors?: Json
      phone?: string | null
      project_description?: string
      project_due_date?: string | null
      project_name?: string
          risks?: string | null
          success_metrics?: string | null
          target_users?: string
          timeline?: string | null
          timezone?: string | null
          website?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          account_status: 'active' | 'inactive' | 'invited' | 'archived'
          created_at: string
          id: string
          name: string
          website: string | null
        }
        Insert: {
          account_status?: 'active' | 'inactive' | 'invited' | 'archived'
          created_at?: string
          id?: string
          name: string
          website?: string | null
        }
        Update: {
          account_status?: 'active' | 'inactive' | 'invited' | 'archived'
          created_at?: string
          id?: string
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          issued_at: string | null
          project_id: string
          status: 'Quote' | 'Draft' | 'Sent' | 'Paid' | 'Cancelled'
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string | null
          project_id: string
          status?: 'Quote' | 'Draft' | 'Sent' | 'Paid' | 'Cancelled'
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string | null
          project_id?: string
          status?: 'Quote' | 'Draft' | 'Sent' | 'Paid' | 'Cancelled'
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      pipeline_order: {
        Row: {
          id: string
          pipeline_column:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          sort: string[] | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          pipeline_column:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          sort?: string[] | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          pipeline_column?:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          sort?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_profile_id_fkey'
            columns: ['actor_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          gdpr_consent: boolean
          id: string
          phone: string | null
          role: 'owner' | 'admin' | 'client' | 'member'
          timezone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean
          id: string
          phone?: string | null
          role: 'owner' | 'admin' | 'client' | 'member'
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean
          id?: string
          phone?: string | null
          role?: 'owner' | 'admin' | 'client' | 'member'
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          assignee_profile_id: string | null
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          labels: string[] | null
          name: string
          priority: string | null
          status:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          tags: string[] | null
          updated_at: string
          value_invoiced: number | null
          value_paid: number | null
          value_quote: number | null
        }
        Insert: {
          archived?: boolean
          assignee_profile_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          name: string
          priority?: string | null
          status?:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          tags?: string[] | null
          updated_at?: string
          value_invoiced?: number | null
          value_paid?: number | null
          value_quote?: number | null
        }
        Update: {
          archived?: boolean
          assignee_profile_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          name?: string
          priority?: string | null
          status?:
            | 'Backlog'
            | 'Call Arranged'
            | 'Brief Gathered'
            | 'UI Stage'
            | 'DB Stage'
            | 'Auth Stage'
            | 'Build'
            | 'QA'
            | 'Handover'
            | 'Closed'
          tags?: string[] | null
          updated_at?: string
          value_invoiced?: number | null
          value_paid?: number | null
          value_quote?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'projects_assignee_profile_id_fkey'
            columns: ['assignee_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
