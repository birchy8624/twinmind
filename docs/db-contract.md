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
