import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/products?offset=0&limit=100&category_id[]=...
 *
 * List products for knowledge sync. Proxied by NForce's MedusaConnector.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productService = req.scope.resolve(Modules.PRODUCT) as any
    const offset = parseInt(req.query.offset as string) || 0
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)

    const filters: Record<string, any> = {}

    // Category filter
    const categoryIds = req.query["category_id[]"]
    if (categoryIds) {
      filters.category_id = Array.isArray(categoryIds) ? categoryIds : [categoryIds]
    }

    const [products, count] = await productService.listAndCountProducts(filters, {
      select: [
        "id", "title", "subtitle", "handle", "description",
        "status", "material", "metadata",
      ],
      relations: [
        "variants", "variants.prices", "variants.options",
        "options", "options.values",
        "categories", "collection", "tags", "images", "type",
      ],
      skip: offset,
      take: limit,
    })

    res.json({ products, count, offset, limit })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
