import { model } from "@medusajs/framework/utils"

/**
 * Single-row configuration store for the NForce plugin.
 *
 * Config is pushed to the plugin by NForce during sync setup
 * (via POST /admin/nforce/setup). No manual configuration needed.
 */
export const NForceConfig = model.define("nforce_config", {
  id: model.id().primaryKey(),
  api_url: model.text(),     // NForce API base URL (e.g. https://platform.nforce.ai/api)
  source_id: model.text(),   // Knowledge source ID on the NForce side
  push_url: model.text(),    // Full webhook URL: {webhooksBaseUrl}/knowledge/push/{sourceId}
  plugin_token: model.text(), // Per-source token for both push and read via X-Plugin-Token header
  last_synced_at: model.dateTime().nullable(),
  last_sync_status: model.text().nullable(),
  last_sync_error: model.text().nullable(),
  document_count: model.number().default(0),
})
