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
      briefs: {
        Row: {
          answers: Json
          completed: boolean | null
          created_at: string | null
          id: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          answers: Json
          completed?: boolean | null
          created_at?: string | null
          id?: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          answers?: Json
          completed?: boolean | null
          created_at?: string | null
          id?: string
          project_id?: string
          updated_at?: string | null
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
          created_at: string | null
          id: string
          profile_id: string
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          profile_id: string
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          role?: string | null
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
      clients: {
        Row: {
          account_status: Database['public']['Enums']['account_status'] | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_status?: Database['public']['Enums']['account_status'] | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_status?: Database['public']['Enums']['account_status'] | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string | null
          id: string
          project_id: string
          visibility: Database['public']['Enums']['visibility_enum']
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string | null
          id?: string
          project_id: string
          visibility?: Database['public']['Enums']['visibility_enum']
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string | null
          id?: string
          project_id?: string
          visibility?: Database['public']['Enums']['visibility_enum']
        }
        Relationships: [
          {
            foreignKeyName: 'comments_author_profile_id_fkey'
            columns: ['author_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string | null
          email: string
          first_name: string | null
          gdpr_consent: boolean | null
          id: string
          is_primary: boolean | null
          last_name: string | null
          phone: string | null
          profile_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email: string
          first_name?: string | null
          gdpr_consent?: boolean | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          phone?: string | null
          profile_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string
          first_name?: string | null
          gdpr_consent?: boolean | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          phone?: string | null
          profile_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      files: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          mime: string | null
          project_id: string
          size: number | null
          storage_path: string
          uploaded_by_profile_id: string
          visibility: Database['public']['Enums']['visibility_enum']
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          mime?: string | null
          project_id: string
          size?: number | null
          storage_path: string
          uploaded_by_profile_id: string
          visibility?: Database['public']['Enums']['visibility_enum']
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          mime?: string | null
          project_id?: string
          size?: number | null
          storage_path?: string
          uploaded_by_profile_id?: string
          visibility?: Database['public']['Enums']['visibility_enum']
        }
        Relationships: [
          {
            foreignKeyName: 'files_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'files_uploaded_by_profile_id_fkey'
            columns: ['uploaded_by_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      invites: {
        Row: {
          accepted_profile_id: string | null
          client_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          accepted_profile_id?: string | null
          client_id: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
        }
        Update: {
          accepted_profile_id?: string | null
          client_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invites_accepted_profile_id_fkey'
            columns: ['accepted_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invites_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          due_at: string | null
          external_url: string | null
          id: string
          issued_at: string | null
          paid_at: string | null
          project_id: string
          status: Database['public']['Enums']['invoice_status']
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          due_at?: string | null
          external_url?: string | null
          id?: string
          issued_at?: string | null
          paid_at?: string | null
          project_id: string
          status?: Database['public']['Enums']['invoice_status']
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          due_at?: string | null
          external_url?: string | null
          id?: string
          issued_at?: string | null
          paid_at?: string | null
          project_id?: string
          status?: Database['public']['Enums']['invoice_status']
          updated_at?: string | null
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
          order_ids: string[]
          pipeline_column: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_ids?: string[]
          pipeline_column: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_ids?: string[]
          pipeline_column?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          gdpr_consent: boolean | null
          id: string
          phone: string | null
          role: Database['public']['Enums']['role']
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          id: string
          phone?: string | null
          role: Database['public']['Enums']['role']
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          id?: string
          phone?: string | null
          role?: Database['public']['Enums']['role']
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_stage_events: {
        Row: {
          changed_at: string | null
          changed_by_profile_id: string | null
          from_status: Database['public']['Enums']['project_status'] | null
          id: string
          project_id: string
          to_status: Database['public']['Enums']['project_status']
        }
        Insert: {
          changed_at?: string | null
          changed_by_profile_id?: string | null
          from_status?: Database['public']['Enums']['project_status'] | null
          id?: string
          project_id: string
          to_status: Database['public']['Enums']['project_status']
        }
        Update: {
          changed_at?: string | null
          changed_by_profile_id?: string | null
          from_status?: Database['public']['Enums']['project_status'] | null
          id?: string
          project_id?: string
          to_status?: Database['public']['Enums']['project_status']
        }
        Relationships: [
          {
            foreignKeyName: 'project_stage_events_changed_by_profile_id_fkey'
            columns: ['changed_by_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_stage_events_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      projects: {
        Row: {
          archived: boolean | null
          assignee_profile_id: string | null
          client_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          labels: string[] | null
          name: string
          priority: Database['public']['Enums']['priority_enum'] | null
          status: Database['public']['Enums']['project_status']
          tags: string[] | null
          updated_at: string | null
          value_invoiced: number | null
          value_paid: number | null
          value_quote: number | null
        }
        Insert: {
          archived?: boolean | null
          assignee_profile_id?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          name: string
          priority?: Database['public']['Enums']['priority_enum'] | null
          status?: Database['public']['Enums']['project_status']
          tags?: string[] | null
          updated_at?: string | null
          value_invoiced?: number | null
          value_paid?: number | null
          value_quote?: number | null
        }
        Update: {
          archived?: boolean | null
          assignee_profile_id?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          name?: string
          priority?: Database['public']['Enums']['priority_enum'] | null
          status?: Database['public']['Enums']['project_status']
          tags?: string[] | null
          updated_at?: string | null
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
      account_status: 'active' | 'inactive' | 'invited' | 'archived'
      invoice_status: 'Quote' | 'Draft' | 'Sent' | 'Paid' | 'Cancelled'
      priority_enum: 'low' | 'medium' | 'high'
      project_status:
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
        | 'Archived'
      visibility_enum: 'both' | 'client' | 'internal'
      role: 'owner' | 'client'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
