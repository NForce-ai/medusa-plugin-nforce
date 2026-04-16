import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NFORCE_MODULE } from "../../../modules/nforce"
import type NForceModuleService from "../../../modules/nforce/service"

/**
 * GET /admin/nforce
 * Returns plugin status for the admin page.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  const config = await nforce.getConfig()

  if (!config) {
    res.json({ configured: false })
    return
  }

  res.json({
    configured: true,
    api_url: config.api_url,
    source_id: config.source_id,
    last_synced_at: config.last_synced_at,
    last_sync_status: config.last_sync_status,
    last_sync_error: config.last_sync_error,
    document_count: config.document_count,
  })
}
