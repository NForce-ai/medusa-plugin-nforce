import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NFORCE_MODULE } from "../../../../modules/nforce"
import type NForceModuleService from "../../../../modules/nforce/service"

/**
 * POST /admin/nforce/setup
 *
 * Called by NForce (via MedusaConnector.setupPlugin) to push connection
 * config into the plugin. Idempotent — safe to call on every sync.
 *
 * Body: { api_url, source_id, push_url, plugin_token }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = req.body as {
    api_url?: string
    source_id?: string
    push_url?: string
    plugin_token?: string
    document_count?: number
    last_synced_at?: string | null
  }

  if (
    !body?.api_url?.trim() ||
    !body?.source_id?.trim() ||
    !body?.push_url?.trim() ||
    !body?.plugin_token?.trim()
  ) {
    res.status(400).json({
      error: "api_url, source_id, push_url, and plugin_token are required",
    })
    return
  }

  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  const existing = await nforce.getConfig()

  // Block setup if the admin hasn't completed the field selection wizard yet
  if (!nforce.isConfigured(existing)) {
    res.status(409).json({
      error: "plugin_not_configured",
      message:
        "The NForce plugin needs initial setup. Open the NForce page in your Medusa admin to select which fields should be included in the knowledge base.",
    })
    return
  }

  await nforce.saveConfig({
    api_url: body.api_url,
    source_id: body.source_id,
    push_url: body.push_url,
    plugin_token: body.plugin_token,
  })

  // Return the field mask so NForce knows which fields to serialize
  res.json({ success: true, field_mask: existing!.field_mask })
}
