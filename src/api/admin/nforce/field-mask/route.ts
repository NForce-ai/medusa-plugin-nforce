import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NFORCE_MODULE } from "../../../../modules/nforce"
import type NForceModuleService from "../../../../modules/nforce/service"
import type { FieldMask } from "../../../../modules/nforce/service"

/**
 * POST /admin/nforce/field-mask
 *
 * Saves the user's field selection from the setup wizard.
 * Body: FieldMask object
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = req.body as FieldMask

  if (!body?.product?.fields || !body?.product?.relations) {
    res.status(400).json({ error: "Invalid field mask: product.fields and product.relations are required" })
    return
  }

  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  await nforce.saveFieldMask(body)

  res.json({ success: true })
}

/**
 * GET /admin/nforce/field-mask
 *
 * Returns the current field mask (or null if not configured).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  const config = await nforce.getConfig()
  res.json({ field_mask: config?.field_mask || null })
}
