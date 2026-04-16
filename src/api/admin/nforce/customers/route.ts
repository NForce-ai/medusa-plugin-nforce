import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/customers?q=...&limit=10
 *
 * Search customers. Proxied by NForce toolkit components.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const customerService = req.scope.resolve(Modules.CUSTOMER) as any
    const q = (req.query.q as string) || ""
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

    const customers = await customerService.listCustomers(
      q ? { q } : {},
      { select: ["id", "first_name", "last_name", "email", "phone"], take: limit }
    )

    res.json({ customers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
