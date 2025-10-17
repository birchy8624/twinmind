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
          id: string
          actor_profile_id: string | null
          action: string
          entity_type: string
          entity_id: string
          meta: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          actor_profile_id?: string | null
          action: string
          entity_type: string
          entity_id: string
          meta?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          actor_profile_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          meta?: Json | null
          created_at?: string | null
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
          id: string
          project_id: string
          answers: Json
          completed: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          answers: Json
          completed?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          answers?: Json
          completed?: boolean | null
          created_at?: string | null
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
          id: string
          client_id: string
          profile_id: string
          role: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          profile_id: string
          role?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          profile_id?: string
          role?: string | null
          created_at?: string | null
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
          id: string
          name: string
          website: string | null
          notes: string | null
          account_status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          website?: string | null
          notes?: string | null
          account_status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          website?: string | null
          notes?: string | null
          account_status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          project_id: string
          author_profile_id: string
          body: string
          visibility: string
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          author_profile_id: string
          body: string
          visibility?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          author_profile_id?: string
          body?: string
          visibility?: string
          created_at?: string | null
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
          id: string
          client_id: string
          profile_id: string | null
          first_name: string | null
          last_name: string | null
          email: string
          phone: string | null
          title: string | null
          is_primary: boolean | null
          gdpr_consent: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          profile_id?: string | null
          first_name?: string | null
          last_name?: string | null
          email: string
          phone?: string | null
          title?: string | null
          is_primary?: boolean | null
          gdpr_consent?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          profile_id?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string
          phone?: string | null
          title?: string | null
          is_primary?: boolean | null
          gdpr_consent?: boolean | null
          created_at?: string | null
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
          id: string
          project_id: string
          uploaded_by_profile_id: string
          storage_path: string
          filename: string
          size: number | null
          mime: string | null
          visibility: string
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          uploaded_by_profile_id: string
          storage_path: string
          filename: string
          size?: number | null
          mime?: string | null
          visibility?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          uploaded_by_profile_id?: string
          storage_path?: string
          filename?: string
          size?: number | null
          mime?: string | null
          visibility?: string
          created_at?: string | null
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
          id: string
          client_id: string
          email: string
          token: string
          expires_at: string
          accepted_profile_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          email: string
          token: string
          expires_at: string
          accepted_profile_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          email?: string
          token?: string
          expires_at?: string
          accepted_profile_id?: string | null
          created_at?: string | null
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
          id: string
          project_id: string
          status: string
          amount: number
          currency: string
          issued_at: string | null
          due_at: string | null
          paid_at: string | null
          external_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          status?: string
          amount: number
          currency?: string
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          external_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          status?: string
          amount?: number
          currency?: string
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          external_url?: string | null
          created_at?: string | null
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
          pipeline_column: string
          order_ids: string[]
          updated_at: string | null
        }
        Insert: {
          id?: string
          pipeline_column: string
          order_ids?: string[]
          updated_at?: string | null
        }
        Update: {
          id?: string
          pipeline_column?: string
          order_ids?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: string
          full_name: string | null
          company: string | null
          email: string | null
          phone: string | null
          timezone: string | null
          gdpr_consent: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          role: string
          full_name?: string | null
          company?: string | null
          email?: string | null
          phone?: string | null
          timezone?: string | null
          gdpr_consent?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          role?: string
          full_name?: string | null
          company?: string | null
          email?: string | null
          phone?: string | null
          timezone?: string | null
          gdpr_consent?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      project_stage_events: {
        Row: {
          id: string
          project_id: string
          from_status: string | null
          to_status: string
          changed_by_profile_id: string | null
          changed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          from_status?: string | null
          to_status: string
          changed_by_profile_id?: string | null
          changed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          from_status?: string | null
          to_status?: string
          changed_by_profile_id?: string | null
          changed_at?: string | null
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
          id: string
          client_id: string
          name: string
          description: string | null
          status: string
          priority: string | null
          value_quote: number | null
          value_invoiced: number | null
          value_paid: number | null
          due_date: string | null
          assignee_profile_id: string | null
          labels: string[] | null
          tags: string[] | null
          archived: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          description?: string | null
          status?: string
          priority?: string | null
          value_quote?: number | null
          value_invoiced?: number | null
          value_paid?: number | null
          due_date?: string | null
          assignee_profile_id?: string | null
          labels?: string[] | null
          tags?: string[] | null
          archived?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          description?: string | null
          status?: string
          priority?: string | null
          value_quote?: number | null
          value_invoiced?: number | null
          value_paid?: number | null
          due_date?: string | null
          assignee_profile_id?: string | null
          labels?: string[] | null
          tags?: string[] | null
          archived?: boolean | null
          created_at?: string | null
          updated_at?: string | null
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
      invoice_status: string
      priority_enum: string
      project_status: string
      visibility_enum: string
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
