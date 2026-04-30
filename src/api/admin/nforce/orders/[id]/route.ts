import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getOrderDetailWorkflow } from "@medusajs/core-flows"

/**
 * GET /admin/nforce/orders/:id
 *
 * Get a single order with computed totals and statuses.
 * Uses Medusa's getOrderDetailWorkflow so the response matches the
 * standard admin endpoint shape.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const workflow = getOrderDetailWorkflow(req.scope)
    const { result: order } = await workflow.run({
      input: {
        order_id: req.params.id,
        fields: [
          "id",
          "display_id",
          "status",
          "payment_status",
          "fulfillment_status",
          "currency_code",
          "total",
          "summary.*",
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
      },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // Workflow returns top-level `total: 0` because it doesn't pull from
    // summary — overlay the computed total from the summary calculator.
    const orderAny = order as any
    if (orderAny?.summary?.current_order_total !== undefined) {
      orderAny.total = orderAny.summary.current_order_total
    }

    res.json({ order: orderAny })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("not found") || message.includes("could not find")) {
      res.status(404).json({ error: "Order not found" })
      return
    }
    res.status(500).json({ error: message })
  }
}
