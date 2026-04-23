import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/products?offset=0&limit=100&category_id[]=...
 *
 * List products for knowledge sync. Proxied by NForce's MedusaConnector.
 * Uses query.graph() to follow module links (Pricing → prices via price_set).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const offset = parseInt(req.query.offset as string) || 0
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)

    const filters: Record<string, any> = {}

    // Category filter
    const categoryIds = req.query["category_id[]"]
    if (categoryIds) {
      const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds]
      filters.categories = { id: ids }
    }

    const { data: products, metadata } = await query.graph({
      entity: "product",
      filters,
      fields: [
        "id",
        "title",
        "subtitle",
        "handle",
        "description",
        "status",
        "material",
        "metadata",
        "type.value",
        "collection.title",
        "collection.handle",
        "categories.name",
        "categories.handle",
        "tags.value",
        "variants.title",
        "variants.sku",
        "variants.options.value",
        "variants.options.option.title",
        "variants.prices.amount",
        "variants.prices.currency_code",
      ],
      pagination: { take: limit, skip: offset },
    })

    res.json({
      products,
      count: metadata?.count ?? products.length,
      offset,
      limit,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
