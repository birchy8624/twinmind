# Database Contract

The following query documents the canonical rules for our database schema. Use it to generate a JSON representation of the current schema whenever you need to verify column definitions, primary keys, or foreign keys in the `public` schema.

```sql
with cols as (
  select table_name, jsonb_agg(
    jsonb_build_object('column', column_name, 'type', data_type, 'nullable', (is_nullable='YES'), 'default', coalesce(column_default,''))
    order by ordinal_position
  ) as columns
  from information_schema.columns where table_schema='public' group by table_name
),
pks as (
  select tc.table_name, jsonb_agg(kc.column_name) as pk
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kc using (constraint_name)
  where tc.table_schema='public' and tc.constraint_type='PRIMARY KEY'
  group by tc.table_name
),
fks as (
  select tc.table_name,
         jsonb_agg(jsonb_build_object('column',kc.column_name,'ref_table',ccu.table_name,'ref_column',ccu.column_name)) as fks
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kc using (constraint_name)
  join information_schema.constraint_column_usage ccu using (constraint_name)
  where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'
  group by tc.table_name
)
select jsonb_object_agg(t.table_name, jsonb_build_object(
  'columns', coalesce(c.columns,'[]'::jsonb),
  'primary_key', coalesce(p.pk,'[]'::jsonb),
  'foreign_keys', coalesce(f.fks,'[]'::jsonb)
)) as schema_json
from information_schema.tables t
left join cols c on c.table_name = t.table_name
left join pks p on p.table_name = t.table_name
left join fks f on f.table_name = t.table_name
where t.table_schema='public' and t.table_type='BASE TABLE';
```

Run this query against the database to retrieve an up-to-date JSON contract for all `public` tables, ensuring we always follow the correct database rules.

## Tables

The following sections summarize the current `public` schema tables, capturing columns, defaults, and key relationships. Reference these when designing queries or validating Supabase policies.

### audit_log

| Column             | Type              | Nullable | Default              | Notes                                   |
| ------------------ | ----------------- | -------- | -------------------- | --------------------------------------- |
| `id`               | `uuid`            | No       | `gen_random_uuid()`  | Primary key.                            |
| `actor_profile_id` | `uuid`            | Yes      | —                    | FK → `profiles.id`.                     |
| `action`           | `text`            | No       | —                    | Describes the performed action.         |
| `entity_type`      | `text`            | No       | —                    | Entity type acted on.                   |
| `entity_id`        | `uuid`            | No       | —                    | Entity identifier.                      |
| `meta`             | `jsonb`           | Yes      | —                    | Structured context for the action.      |
| `created_at`       | `timestamptz`     | Yes      | `now()`              |                                         |

### briefs

| Column        | Type          | Nullable | Default             | Notes                              |
| ------------- | ------------- | -------- | ------------------- | ---------------------------------- |
| `id`          | `uuid`        | No       | `gen_random_uuid()` | Primary key.                       |
| `project_id`  | `uuid`        | No       | —                   | FK → `projects.id`.                |
| `answers`     | `jsonb`       | No       | —                   | Stores questionnaire results.      |
| `completed`   | `boolean`     | Yes      | `false`             | Indicates whether the brief is done. |
| `created_at`  | `timestamptz` | Yes      | `now()`             |                                    |
| `updated_at`  | `timestamptz` | Yes      | `now()`             |                                    |

### client_members

| Column        | Type          | Nullable | Default             | Notes                            |
| ------------- | ------------- | -------- | ------------------- | -------------------------------- |
| `id`          | `uuid`        | No       | `gen_random_uuid()` | Primary key.                     |
| `client_id`   | `uuid`        | No       | —                   | FK → `clients.id`.               |
| `profile_id`  | `uuid`        | No       | —                   | FK → `profiles.id`.              |
| `role`        | `text`        | Yes      | `'client'`          | Custom role label.               |
| `created_at`  | `timestamptz` | Yes      | `now()`             |                                  |

### clients

| Column          | Type          | Nullable | Default             | Notes                       |
| --------------- | ------------- | -------- | ------------------- | --------------------------- |
| `id`            | `uuid`        | No       | `gen_random_uuid()` | Primary key.                |
| `name`          | `text`        | No       | —                   | Client name.                |
| `website`       | `text`        | Yes      | —                   |                              |
| `notes`         | `text`        | Yes      | —                   |                              |
| `account_status`| `text`        | Yes      | `'active'`          | Workflow status.            |
| `created_at`    | `timestamptz` | Yes      | `now()`             |                              |
| `updated_at`    | `timestamptz` | Yes      | `now()`             |                              |

### comments

| Column               | Type               | Nullable | Default             | Notes                                  |
| -------------------- | ------------------ | -------- | ------------------- | -------------------------------------- |
| `id`                 | `uuid`             | No       | `gen_random_uuid()` | Primary key.                           |
| `project_id`         | `uuid`             | No       | —                   | FK → `projects.id`.                    |
| `author_profile_id`  | `uuid`             | No       | —                   | FK → `profiles.id`.                    |
| `body`               | `text`             | No       | —                   | Comment content.                       |
| `visibility`         | `visibility_enum`  | No       | `'both'`            | Visibility flag for agencies/clients.  |
| `created_at`         | `timestamptz`      | Yes      | `now()`             |                                        |

### contacts

| Column        | Type          | Nullable | Default             | Notes                                      |
| ------------- | ------------- | -------- | ------------------- | ------------------------------------------ |
| `id`          | `uuid`        | No       | `gen_random_uuid()` | Primary key.                               |
| `client_id`   | `uuid`        | No       | —                   | FK → `clients.id`.                         |
| `profile_id`  | `uuid`        | Yes      | —                   | Optional FK → `profiles.id`.               |
| `first_name`  | `text`        | Yes      | —                   |                                            |
| `last_name`   | `text`        | Yes      | —                   |                                            |
| `email`       | `text`        | No       | —                   | Unique per contact at business level.      |
| `phone`       | `text`        | Yes      | —                   |                                            |
| `title`       | `text`        | Yes      | —                   | Job title.                                 |
| `is_primary`  | `boolean`     | Yes      | `false`             | Whether this is the primary contact.       |
| `gdpr_consent`| `boolean`     | Yes      | `false`             | GDPR opt-in flag.                          |
| `created_at`  | `timestamptz` | Yes      | `now()`             |                                            |
| `updated_at`  | `timestamptz` | Yes      | `now()`             |                                            |

### files

| Column                 | Type               | Nullable | Default             | Notes                               |
| ---------------------- | ------------------ | -------- | ------------------- | ----------------------------------- |
| `id`                   | `uuid`             | No       | `gen_random_uuid()` | Primary key.                        |
| `project_id`           | `uuid`             | No       | —                   | FK → `projects.id`.                 |
| `uploaded_by_profile_id` | `uuid`           | No       | —                   | FK → `profiles.id`.                 |
| `storage_path`         | `text`             | No       | —                   | Supabase storage reference.        |
| `filename`             | `text`             | No       | —                   | Display name.                      |
| `size`                 | `integer`          | Yes      | —                   | Size in bytes.                     |
| `mime`                 | `text`             | Yes      | —                   | MIME type.                         |
| `visibility`           | `visibility_enum`  | No       | `'both'`            | Controls agency/client visibility. |
| `created_at`           | `timestamptz`      | Yes      | `now()`             |                                   |

### invites

| Column               | Type          | Nullable | Default             | Notes                                  |
| -------------------- | ------------- | -------- | ------------------- | -------------------------------------- |
| `id`                 | `uuid`        | No       | `gen_random_uuid()` | Primary key.                           |
| `client_id`          | `uuid`        | No       | —                   | FK → `clients.id`.                     |
| `email`              | `text`        | No       | —                   | Invitee email.                         |
| `token`              | `text`        | No       | —                   | Unique invite token.                   |
| `expires_at`         | `timestamptz` | No       | —                   | Expiration timestamp.                  |
| `accepted_profile_id`| `uuid`        | Yes      | —                   | FK → `profiles.id` when accepted.      |
| `created_at`         | `timestamptz` | Yes      | `now()`             |                                        |

### invoices

| Column        | Type             | Nullable | Default             | Notes                             |
| ------------- | ---------------- | -------- | ------------------- | --------------------------------- |
| `id`          | `uuid`           | No       | `gen_random_uuid()` | Primary key.                      |
| `project_id`  | `uuid`           | No       | —                   | FK → `projects.id`.               |
| `status`      | `invoice_status` | No       | `'Quote'`           | Invoice lifecycle state.          |
| `amount`      | `numeric`        | No       | —                   | Monetary amount.                  |
| `currency`    | `text`           | No       | `'EUR'`             | ISO currency code.                |
| `issued_at`   | `timestamptz`    | Yes      | `now()`             |                                   |
| `due_at`      | `timestamptz`    | Yes      | —                   |                                   |
| `paid_at`     | `timestamptz`    | Yes      | —                   |                                   |
| `external_url`| `text`           | Yes      | —                   | Link to external invoice system.  |
| `created_at`  | `timestamptz`    | Yes      | `now()`             |                                   |
| `updated_at`  | `timestamptz`    | Yes      | `now()`             |                                   |

### pipeline_order

| Column            | Type          | Nullable | Default             | Notes                                             |
| ----------------- | ------------- | -------- | ------------------- | ------------------------------------------------- |
| `id`              | `uuid`        | No       | `gen_random_uuid()` | Primary key.                                      |
| `pipeline_column` | `USER-DEFINED`| No       | —                   | Custom enum representing pipeline columns (unique). |
| `order_ids`       | `uuid[]`      | No       | `'{}'`              | Ordered project IDs per column.                   |
| `updated_at`      | `timestamptz` | Yes      | `now()`             |                                                  |

### profiles

| Column         | Type          | Nullable | Default             | Notes                                    |
| -------------- | ------------- | -------- | ------------------- | ---------------------------------------- |
| `id`           | `uuid`        | No       | —                   | Primary key, FK → `auth.users.id`.       |
| `role`         | `role_enum`   | No       | —                   | Application role.                        |
| `full_name`    | `text`        | Yes      | —                   |                                          |
| `company`      | `text`        | Yes      | —                   |                                          |
| `email`        | `text`        | Yes      | —                   |                                          |
| `phone`        | `text`        | Yes      | —                   |                                          |
| `timezone`     | `text`        | Yes      | —                   |                                          |
| `gdpr_consent` | `boolean`     | Yes      | `false`             | GDPR opt-in flag.                        |
| `created_at`   | `timestamptz` | Yes      | `now()`             |                                          |
| `updated_at`   | `timestamptz` | Yes      | `now()`             |                                          |

### project_stage_events

| Column                 | Type             | Nullable | Default             | Notes                            |
| ---------------------- | ---------------- | -------- | ------------------- | -------------------------------- |
| `id`                   | `uuid`           | No       | `gen_random_uuid()` | Primary key.                     |
| `project_id`           | `uuid`           | No       | —                   | FK → `projects.id`.              |
| `from_status`          | `project_status` | Yes      | —                   | Previous status.                 |
| `to_status`            | `project_status` | No       | —                   | New status.                      |
| `changed_by_profile_id`| `uuid`           | Yes      | —                   | FK → `profiles.id`.              |
| `changed_at`           | `timestamptz`    | Yes      | `now()`             | Timestamp of the change event.   |

### projects

| Column               | Type             | Nullable | Default             | Notes                                          |
| -------------------- | ---------------- | -------- | ------------------- | ---------------------------------------------- |
| `id`                 | `uuid`           | No       | `gen_random_uuid()` | Primary key.                                   |
| `client_id`          | `uuid`           | No       | —                   | FK → `clients.id`.                             |
| `name`               | `text`           | No       | —                   | Project name.                                  |
| `description`        | `text`           | Yes      | —                   |                                                |
| `status`             | `project_status` | No       | `'Backlog'`         | Current pipeline status.                       |
| `priority`           | `priority_enum`  | Yes      | `'medium'`          | Prioritization flag.                           |
| `value_quote`        | `numeric`        | Yes      | —                   | Proposed value.                                |
| `value_invoiced`     | `numeric`        | Yes      | —                   | Sum of invoices issued.                        |
| `value_paid`         | `numeric`        | Yes      | —                   | Sum of paid invoices.                          |
| `due_date`           | `date`           | Yes      | —                   | Target due date.                               |
| `assignee_profile_id`| `uuid`           | Yes      | —                   | FK → `profiles.id`.                            |
| `labels`             | `text[]`         | Yes      | —                   | Free-form labels.                              |
| `tags`               | `text[]`         | Yes      | —                   | Structured tags.                               |
| `archived`           | `boolean`        | Yes      | `false`             | Soft delete flag.                              |
| `created_at`         | `timestamptz`    | No       | `now()`             |                                              |
| `updated_at`         | `timestamptz`    | Yes      | `now()`             |                                              |

