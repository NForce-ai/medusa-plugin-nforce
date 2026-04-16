import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NFORCE_MODULE } from "../../../../modules/nforce"
import type NForceModuleService from "../../../../modules/nforce/service"

/**
 * GET /admin/nforce/agents
 *
 * Proxies to the NForce webhook endpoint to fetch agents linked to
 * the knowledge source associated with this Medusa store.
 * Called by the plugin admin page.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  const config = await nforce.getConfig()

  if (!config) {
    res.json({ agents: [] })
    return
  }

  try {
    const apiUrl = config.api_url.replace(/\/$/, "")
    const url = `${apiUrl}/webhooks/knowledge/source/${config.source_id}/agents`

    const response = await fetch(url, {
      headers: { "X-Plugin-Token": config.plugin_token },
    })

    if (!response.ok) {
      res.json({ agents: [], error: `NForce returned HTTP ${response.status}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.json({ agents: [], error: message })
  }
}
