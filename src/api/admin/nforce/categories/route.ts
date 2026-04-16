import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/categories
 *
 * Returns all product categories for the category selector in the setup wizard.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productService = req.scope.resolve(Modules.PRODUCT) as any
    const categories = await productService.listProductCategories(
      {},
      { select: ["id", "name", "handle", "parent_category_id"], order: { name: "ASC" } }
    )

    res.json({
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        parent_id: c.parent_category_id || null,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Failed to fetch categories: ${message}` })
  }
}
