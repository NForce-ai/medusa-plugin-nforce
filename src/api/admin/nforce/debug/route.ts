import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/debug?entity=order&id=order_01XXX
 *
 * Inspect the full available field shape for any entity. Returns the first
 * matching record with all top-level fields populated. Use this when you
 * need to know what fields are actually available on an entity before
 * writing a query.graph() call.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const entity = (req.query.entity as string) || "order"
  const id = req.query.id as string

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity,
      filters: id ? { id } : {},
      fields: ["*"],
      pagination: { take: 1 },
    })

    if (!data?.length) {
      res.status(404).json({ error: `No ${entity} found` })
      return
    }

    res.json({ entity, record: data[0], available_keys: Object.keys(data[0]) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
