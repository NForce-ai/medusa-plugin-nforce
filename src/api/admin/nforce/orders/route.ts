import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getOrdersListWorkflow } from "@medusajs/core-flows"

/**
 * GET /admin/nforce/orders?customer_id=...&display_id=...&limit=5
 *
 * List orders. Uses the same workflow as Medusa's standard admin endpoint
 * so payment_status, fulfillment_status, and totals are computed correctly.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 50)

    const filters: Record<string, any> = { is_draft_order: false }
    if (req.query.customer_id) filters.customer_id = req.query.customer_id
    if (req.query.display_id) filters.display_id = parseInt(req.query.display_id as string)

    const workflow = getOrdersListWorkflow(req.scope)
    const { result } = await workflow.run({
      input: {
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
          "items.quantity",
        ],
        variables: {
          filters,
          take: limit,
          skip: 0,
          order: { created_at: "DESC" },
        },
      },
    })

    const { rows } = result as { rows: any[]; metadata: any }

    // Overlay computed total from summary (top-level `total` is 0 from the workflow)
    for (const o of rows) {
      if (o?.summary?.current_order_total !== undefined) {
        o.total = o.summary.current_order_total
      }
    }

    res.json({ orders: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
