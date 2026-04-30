import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/orders/:id
 *
 * Get a single order by internal ID. Proxied by NForce toolkit components.
 * Uses query.graph() to follow Fulfillment module links.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: req.params.id },
      fields: [
        "id",
        "display_id",
        "status",
        "payment_status",
        "fulfillment_status",
        "currency_code",
        "total",
        "created_at",
        "items.title",
        "items.subtitle",
        "items.variant_title",
        "items.quantity",
        "items.unit_price",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.address_1",
        "shipping_address.city",
        "shipping_address.province",
        "shipping_address.postal_code",
        "shipping_address.country_code",
        "fulfillments.id",
        "fulfillments.requires_shipping",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        "fulfillments.packed_at",
        "fulfillments.canceled_at",
        "fulfillments.labels.tracking_number",
        "fulfillments.labels.tracking_url",
      ],
    })

    if (!orders || orders.length === 0) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    res.json({ order: orders[0] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
