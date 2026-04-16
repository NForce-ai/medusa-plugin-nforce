import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/orders/:id
 *
 * Get a single order by internal ID. Proxied by NForce toolkit components.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(req.params.id, {
      select: [
        "id", "display_id", "status", "currency_code",
        "total", "payment_status", "fulfillment_status",
        "created_at", "shipping_address",
      ],
      relations: ["items", "fulfillments", "shipping_address"],
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    res.json({ order })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("not found") || message.includes("could not find")) {
      res.status(404).json({ error: "Order not found" })
      return
    }
    res.status(500).json({ error: message })
  }
}
