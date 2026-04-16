import { MedusaService } from "@medusajs/framework/utils"
import { NForceConfig } from "./models/nforce-config"
import {
  serializeMedusaProduct,
  type SerializableMedusaProduct,
} from "../../utils/serialize-product"

export type NForceConfigShape = {
  id: string
  api_url: string
  source_id: string
  push_url: string
  plugin_token: string
  last_synced_at: Date | null
  last_sync_status: string | null
  last_sync_error: string | null
  document_count: number
}

export type PushPayload = {
  external_id: string
  title?: string
  content?: string
  action?: "upsert" | "delete"
}

export type PushResult = {
  success: boolean
  document_id?: number
  skipped?: boolean
  action: "upsert" | "delete"
}

const SINGLETON_ID = "nforce_config_singleton"

class NForceModuleService extends MedusaService({
  NForceConfig,
}) {
  /**
   * Fetch the singleton config row. Returns null if the plugin
   * hasn't been configured by NForce yet.
   */
  async getConfig(): Promise<NForceConfigShape | null> {
    const rows = await this.listNForceConfigs(
      { id: SINGLETON_ID },
      { take: 1 }
    )
    return (rows[0] as NForceConfigShape | undefined) ?? null
  }

  /**
   * Create or update the singleton config row.
   * Called by the setup endpoint when NForce pushes config to the plugin.
   */
  async saveConfig(input: {
    api_url: string
    source_id: string
    push_url: string
    plugin_token: string
  }): Promise<NForceConfigShape> {
    const existing = await this.getConfig()

    if (existing) {
      // @ts-ignore — generated method, dynamic name
      const updated = await this.updateNForceConfigs({
        id: SINGLETON_ID,
        api_url: input.api_url,
        source_id: input.source_id,
        push_url: input.push_url,
        plugin_token: input.plugin_token,
      })
      return Array.isArray(updated)
        ? (updated[0] as NForceConfigShape)
        : (updated as NForceConfigShape)
    }

    // @ts-ignore — generated method, dynamic name
    const created = await this.createNForceConfigs({
      id: SINGLETON_ID,
      api_url: input.api_url,
      source_id: input.source_id,
      push_url: input.push_url,
      plugin_token: input.plugin_token,
      last_synced_at: null,
      last_sync_status: null,
      last_sync_error: null,
      document_count: 0,
    })
    return Array.isArray(created)
      ? (created[0] as NForceConfigShape)
      : (created as NForceConfigShape)
  }

  /**
   * Update sync state metadata after a sync or push attempt.
   */
  async setSyncState(state: {
    status: "idle" | "syncing" | "failed" | "ok"
    error?: string | null
    documentCount?: number
  }): Promise<void> {
    const existing = await this.getConfig()
    if (!existing) return

    const patch: Record<string, unknown> = {
      id: SINGLETON_ID,
      last_sync_status: state.status,
      last_sync_error: state.error ?? null,
    }
    if (state.status === "ok") {
      patch.last_synced_at = new Date()
    }
    if (state.documentCount !== undefined) {
      patch.document_count = state.documentCount
    }

    // @ts-ignore — generated method, dynamic name
    await this.updateNForceConfigs(patch)
  }

  /**
   * Serialize a Medusa product into the canonical document text.
   * Mirrors api.nforce.ai/app/services/knowledge/medusa_product_serializer.ts.
   */
  serializeProduct(product: SerializableMedusaProduct): string {
    return serializeMedusaProduct(product)
  }

  /**
   * POST a document to the NForce webhook push endpoint.
   *
   * Returns false if the plugin hasn't been configured yet.
   * Throws on network errors or non-2xx responses.
   */
  async pushDocument(payload: PushPayload): Promise<PushResult | false> {
    const config = await this.getConfig()
    if (!config) return false

    const response = await fetch(config.push_url, {
      method: "POST",
      headers: {
        "X-Plugin-Token": config.plugin_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: payload.external_id,
        title: payload.title,
        content: payload.content,
        action: payload.action ?? "upsert",
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`NForce push failed: HTTP ${response.status} ${text}`)
    }

    return (await response.json()) as PushResult
  }
}

export default NForceModuleService
