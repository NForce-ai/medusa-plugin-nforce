import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NFORCE_MODULE } from "../modules/nforce"
import type NForceModuleService from "../modules/nforce/service"
import type { SerializableMedusaProduct } from "../utils/serialize-product"

/**
 * Subscribes to product.created and product.updated. Fetches the full
 * product graph via the Query module and pushes an upsert to NForce.
 */
export default async function productChangedHandler({
  event,
  container,
}: SubscriberArgs<{ id?: string; ids?: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const nforce = container.resolve(NFORCE_MODULE) as NForceModuleService

  const config = await nforce.getConfig()
  if (!config) {
    // Plugin not configured yet — no-op silently
    return
  }

  const ids = extractIds(event.data)
  if (ids.length === 0) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    filters: { id: ids },
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

  for (const product of products as SerializableMedusaProduct[]) {
    try {
      const content = nforce.serializeProduct(product)
      await nforce.pushDocument({
        external_id: product.id,
        title: product.title || product.handle || product.id,
        content,
        action: "upsert",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`NForce push failed for product ${product.id}: ${message}`)
    }
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
  context: {
    subscriberId: "nforce-product-changed",
  },
}

function extractIds(data: { id?: string; ids?: string[] } | undefined): string[] {
  if (!data) return []
  if (Array.isArray(data.ids)) return data.ids.filter((x): x is string => !!x)
  if (typeof data.id === "string") return [data.id]
  return []
}
