import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/orders?customer_id=...&display_id=...&limit=5
 *
 * List orders. Supports filtering by customer_id or display_id.
 * Proxied by NForce toolkit components.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 50)

    const filters: Record<string, any> = {}
    if (req.query.customer_id) filters.customer_id = req.query.customer_id
    if (req.query.display_id) filters.display_id = parseInt(req.query.display_id as string)

    const orders = await orderService.listOrders(filters, {
      select: [
        "id", "display_id", "status", "currency_code",
        "total", "payment_status", "fulfillment_status",
        "created_at",
      ],
      relations: ["items"],
      take: limit,
      order: { created_at: "DESC" },
    })

    res.json({ orders })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
