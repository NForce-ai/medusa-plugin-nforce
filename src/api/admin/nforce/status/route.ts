import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NFORCE_MODULE } from "../../../../modules/nforce"
import type NForceModuleService from "../../../../modules/nforce/service"

/**
 * GET /admin/nforce/status
 *
 * Fetches live sync status from the NForce source.
 * Returns the authoritative sync state (not a stale copy).
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

  try {
    const apiUrl = config.api_url.replace(/\/$/, "")
    const url = `${apiUrl}/webhooks/knowledge/source/${config.source_id}/status`

    const response = await fetch(url, {
      headers: { "X-Plugin-Token": config.plugin_token },
    })

    if (!response.ok) {
      res.json({
        configured: true,
        sync_status: "unknown",
        error: `NForce returned HTTP ${response.status}`,
      })
      return
    }

    const data = await response.json()
    res.json({ configured: true, ...data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.json({ configured: true, sync_status: "unknown", error: message })
  }
}
