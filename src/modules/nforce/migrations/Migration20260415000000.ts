import { Migration } from "@mikro-orm/migrations"

export class Migration20260415000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "nforce_config" (
        "id" text not null,
        "api_url" text not null,
        "source_id" text not null,
        "push_url" text not null,
        "plugin_token" text not null,
        "field_mask" jsonb null,
        "last_synced_at" timestamptz null,
        "last_sync_status" text null,
        "last_sync_error" text null,
        "document_count" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "nforce_config_pkey" primary key ("id")
      );`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_nforce_config_deleted_at" ON "nforce_config" (deleted_at) WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "nforce_config" cascade;`)
  }
}
