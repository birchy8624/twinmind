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
      account_members: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          profile_id: string
          role: Database['public']['Enums']['account_role']
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          profile_id: string
          role?: Database['public']['Enums']['account_role']
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          role?: Database['public']['Enums']['account_role']
        }
        Relationships: [
          {
            foreignKeyName: 'account_members_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'account_members_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      accounts: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
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
      briefs: {
        Row: {
          account_id: string | null
          answers: Json
          completed: boolean | null
          created_at: string | null
          id: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          answers: Json
          completed?: boolean | null
          created_at?: string | null
          id?: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          answers?: Json
          completed?: boolean | null
          created_at?: string | null
          id?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'briefs_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
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
          account_id: string | null
          account_status: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          account_status?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          account_status?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clients_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          }
        ]
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
            foreignKeyName: 'invoices_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
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
          pipeline_column: Database['public']['Enums']['project_status']
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_ids?: string[]
          pipeline_column: Database['public']['Enums']['project_status']
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_ids?: string[]
          pipeline_column?: Database['public']['Enums']['project_status']
          updated_at?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          limits: Json
          monthly_price_cents: number
          name: string
        }
        Insert: {
          code: string
          limits: Json
          monthly_price_cents: number
          name: string
        }
        Update: {
          code?: string
          limits?: Json
          monthly_price_cents?: number
          name?: string
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
          role: Database['public']['Enums']['role_enum']
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
          role: Database['public']['Enums']['role_enum']
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
          role?: Database['public']['Enums']['role_enum']
          timezone?: string | null
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
          account_id: string | null
          archived: boolean | null
          assignee_profile_id: string | null
          client_id: string
          created_at: string
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
          account_id?: string | null
          archived?: boolean | null
          assignee_profile_id?: string | null
          client_id: string
          created_at?: string
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
          account_id?: string | null
          archived?: boolean | null
          assignee_profile_id?: string | null
          client_id?: string
          created_at?: string
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
            foreignKeyName: 'projects_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
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
      subscriptions: {
        Row: {
          account_id: string
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_code: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_account_id_fkey'
            columns: ['account_id']
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_plan_code_fkey'
            columns: ['plan_code']
            referencedRelation: 'plans'
            referencedColumns: ['code']
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
      account_role: 'owner' | 'member'
      invoice_status: 'Quote' | 'Invoice Sent' | 'Payment Made' | 'Sent' | 'Paid'
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
      role_enum: 'owner' | 'client'
      visibility_enum: 'owner' | 'client' | 'both'
    }
    Policies: {
      account_members: []
      accounts: []
      audit_log: [
        {
          command: 'SELECT'
          name: 'al_client_read'
          roles: ['public']
          using: 'true'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'al_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      briefs: [
        {
          command: 'SELECT'
          name: 'br_client_read'
          roles: ['public']
          using: 'project_accessible_by_auth_user(project_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'br_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        },
        {
          command: 'SELECT'
          name: 'briefs_access'
          roles: ['public']
          using:
            "(is_owner() OR (EXISTS ( SELECT 1\n   FROM (projects p\n     LEFT JOIN client_members cm ON ((cm.client_id = p.client_id)))\n  WHERE ((p.id = briefs.project_id) AND ((auth.uid() = p.assignee_profile_id) OR (cm.profile_id = auth.uid()))))))"
          with_check: null
        },
        {
          command: 'ALL'
          name: 'briefs_member_rw'
          roles: ['public']
          using: 'is_account_member(account_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'briefs_mutate'
          roles: ['public']
          using:
            "(is_owner() OR (EXISTS ( SELECT 1\n   FROM (projects p\n     LEFT JOIN client_members cm ON ((cm.client_id = p.client_id)))\n  WHERE ((p.id = briefs.project_id) AND ((auth.uid() = p.assignee_profile_id) OR (cm.profile_id = auth.uid()))))))"
          with_check:
            "(is_owner() OR (EXISTS ( SELECT 1\n   FROM (projects p\n     LEFT JOIN client_members cm ON ((cm.client_id = p.client_id)))\n  WHERE ((p.id = briefs.project_id) AND ((auth.uid() = p.assignee_profile_id) OR (cm.profile_id = auth.uid()))))))"
        },
        {
          command: 'ALL'
          name: 'briefs_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      client_members: [
        {
          command: 'DELETE'
          name: 'cm_owner_del'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        },
        {
          command: 'INSERT'
          name: 'cm_owner_ins'
          roles: ['public']
          using: null
          with_check: 'is_owner()'
        },
        {
          command: 'UPDATE'
          name: 'cm_owner_upd'
          roles: ['public']
          using: 'is_owner()'
          with_check: 'is_owner()'
        },
        {
          command: 'SELECT'
          name: 'cm_self_select'
          roles: ['public']
          using: '(profile_id = auth.uid())'
          with_check: null
        }
      ]
      clients: [
        {
          command: 'SELECT'
          name: 'clients_client_read'
          roles: ['public']
          using:
            "(EXISTS ( SELECT 1\n   FROM client_members m\n  WHERE ((m.client_id = clients.id) AND (m.profile_id = auth.uid()))))"
          with_check: null
        },
        {
          command: 'ALL'
          name: 'clients_member_rw'
          roles: ['public']
          using: 'is_account_member(account_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'clients_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      comments: [
        {
          command: 'INSERT'
          name: 'com_client_insert'
          roles: ['public']
          using: null
          with_check:
            "(project_accessible_by_auth_user(project_id) AND (author_profile_id = auth.uid()) AND (visibility = ANY (ARRAY['client'::visibility_enum, 'both'::visibility_enum])))"
        },
        {
          command: 'SELECT'
          name: 'com_client_read'
          roles: ['public']
          using:
            "(project_accessible_by_auth_user(project_id) AND (visibility = ANY (ARRAY['client'::visibility_enum, 'both'::visibility_enum])))"
          with_check: null
        },
        {
          command: 'ALL'
          name: 'com_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      contacts: [
        {
          command: 'SELECT'
          name: 'contacts_client_read'
          roles: ['public']
          using:
            "(EXISTS ( SELECT 1\n   FROM client_members m\n  WHERE ((m.client_id = contacts.client_id) AND (m.profile_id = auth.uid()))))"
          with_check: null
        },
        {
          command: 'ALL'
          name: 'contacts_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      files: [
        {
          command: 'INSERT'
          name: 'f_client_insert'
          roles: ['public']
          using: null
          with_check:
            "(project_accessible_by_auth_user(project_id) AND (uploaded_by_profile_id = auth.uid()) AND (visibility = ANY (ARRAY['client'::visibility_enum, 'both'::visibility_enum])))"
        },
        {
          command: 'SELECT'
          name: 'f_client_read'
          roles: ['public']
          using:
            "(project_accessible_by_auth_user(project_id) AND (visibility = ANY (ARRAY['client'::visibility_enum, 'both'::visibility_enum])))"
          with_check: null
        },
        {
          command: 'ALL'
          name: 'f_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      invites: []
      invoices: [
        {
          command: 'SELECT'
          name: 'inv_client_read'
          roles: ['public']
          using: 'project_accessible_by_auth_user(project_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'inv_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'invoices_access'
          roles: ['public']
          using:
            "(is_owner() OR (EXISTS ( SELECT 1\n   FROM (projects p\n     LEFT JOIN client_members cm ON ((cm.client_id = p.client_id)))\n  WHERE ((p.id = invoices.project_id) AND ((auth.uid() = p.assignee_profile_id) OR (cm.profile_id = auth.uid()))))))"
          with_check:
            "(is_owner() OR (EXISTS ( SELECT 1\n   FROM (projects p\n     LEFT JOIN client_members cm ON ((cm.client_id = p.client_id)))\n  WHERE ((p.id = invoices.project_id) AND ((auth.uid() = p.assignee_profile_id) OR (cm.profile_id = auth.uid()))))))"
        },
        {
          command: 'ALL'
          name: 'invoices_member_rw'
          roles: ['public']
          using: 'is_account_member(account_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'invoices_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      pipeline_order: [
        {
          command: 'SELECT'
          name: 'po_client_read'
          roles: ['public']
          using: 'true'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'po_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      plans: []
      profiles: [
        {
          command: 'DELETE'
          name: 'pf_owner_del'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        },
        {
          command: 'INSERT'
          name: 'pf_owner_ins'
          roles: ['public']
          using: null
          with_check: 'is_owner()'
        },
        {
          command: 'UPDATE'
          name: 'pf_owner_upd'
          roles: ['public']
          using: 'is_owner()'
          with_check: 'is_owner()'
        },
        {
          command: 'SELECT'
          name: 'pf_read_min'
          roles: ['public']
          using: "(auth.role() = 'authenticated'::text)"
          with_check: null
        },
        {
          command: 'SELECT'
          name: 'prof_self_read'
          roles: ['public']
          using: '(id = auth.uid())'
          with_check: null
        },
        {
          command: 'UPDATE'
          name: 'prof_self_upd'
          roles: ['public']
          using: '(id = auth.uid())'
          with_check: '(id = auth.uid())'
        }
      ]
      project_stage_events: [
        {
          command: 'SELECT'
          name: 'pse_client_read'
          roles: ['public']
          using: 'project_accessible_by_auth_user(project_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'pse_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      projects: [
        {
          command: 'ALL'
          name: 'pr_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: 'is_owner()'
        },
        {
          command: 'ALL'
          name: 'projects_member_rw'
          roles: ['public']
          using: 'is_account_member(account_id)'
          with_check: null
        },
        {
          command: 'ALL'
          name: 'projects_owner_all'
          roles: ['public']
          using: 'is_owner()'
          with_check: null
        }
      ]
      subscriptions: []
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
