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
    res.json({ configured: false, has_field_mask: false })
    return
  }

  // "configured" means NForce has pushed connection config (api_url, push_url, etc.)
  // "has_field_mask" means the admin has completed the field selection wizard
  const configured = !!config.api_url && !!config.push_url
  const hasFieldMask = !!config.field_mask

  res.json({
    configured,
    has_field_mask: hasFieldMask,
    api_url: config.api_url || null,
    source_id: config.source_id || null,
  })
}
