import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NFORCE_MODULE } from "../../../../modules/nforce"
import type NForceModuleService from "../../../../modules/nforce/service"
import type { SerializableMedusaProduct } from "../../../../utils/serialize-product"

const PAGE_SIZE = 100

/**
 * POST /admin/nforce/sync
 *
 * Backfills all products in the store to the configured NForce source.
 * Runs synchronously and reports counts in the response. For very large
 * catalogs you'd want to move this into a background workflow, but for
 * v1 a foreground request is simpler and good enough.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const nforce = req.scope.resolve(NFORCE_MODULE) as NForceModuleService
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const config = await nforce.getConfig()
  if (!config) {
    res.status(400).json({ error: "Plugin is not configured" })
    return
  }

  await nforce.setSyncState({ status: "syncing" })

  let pushed = 0
  let failed = 0
  let skip = 0

  try {
    while (true) {
      const { data: products } = await query.graph({
        entity: "product",
        pagination: { take: PAGE_SIZE, skip },
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
      })

      if (!products || products.length === 0) break

      for (const product of products as SerializableMedusaProduct[]) {
        try {
          const content = nforce.serializeProduct(product)
          await nforce.pushDocument({
            external_id: product.id,
            title: product.title || product.handle || product.id,
            content,
            action: "upsert",
          })
          pushed++
        } catch (err: unknown) {
          failed++
          const message = err instanceof Error ? err.message : String(err)
          logger.error(`nforce sync failed for product ${product.id}: ${message}`)
        }
      }

      if (products.length < PAGE_SIZE) break
      skip += PAGE_SIZE
    }

    await nforce.setSyncState({
      status: failed > 0 && pushed === 0 ? "failed" : "ok",
      error: failed > 0 ? `${failed} product(s) failed to push` : null,
      documentCount: pushed,
    })

    res.json({ pushed, failed, total: pushed + failed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await nforce.setSyncState({ status: "failed", error: message })
    res.status(500).json({ error: message, pushed, failed })
  }
}
