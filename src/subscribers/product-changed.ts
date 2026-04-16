import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NFORCE_MODULE } from "../modules/nforce"
import type NForceModuleService from "../modules/nforce/service"
import type { SerializableMedusaProduct, FieldMask } from "../utils/serialize-product"

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
  if (!config || !config.field_mask) {
    // Plugin not configured yet — no-op silently
    return
  }

  const ids = extractIds(event.data)
  if (ids.length === 0) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fields = buildGraphFields(config.field_mask)
  const categoryFilter = config.field_mask.category_ids

  const { data: products } = await query.graph({
    entity: "product",
    filters: {
      id: ids,
      ...(categoryFilter ? { categories: { id: categoryFilter } } : {}),
    } as any,
    fields,
  })

  for (const product of products as SerializableMedusaProduct[]) {
    try {
      const content = nforce.serializeProduct(product, config.field_mask)
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

/**
 * Build the query.graph() fields list from the field mask.
 * Always includes "id" and "title". Conditionally adds other product
 * fields, relations, and custom module fields.
 */
function buildGraphFields(mask: NonNullable<FieldMask>): string[] {
  const fields: string[] = ["id", "title"]

  // Product scalar fields
  const scalarMap: Record<string, string> = {
    subtitle: "subtitle",
    handle: "handle",
    description: "description",
    status: "status",
    material: "material",
    metadata: "metadata",
  }
  for (const [key, graphField] of Object.entries(scalarMap)) {
    if (mask.product.fields[key] !== false) {
      fields.push(graphField)
    }
  }

  // Product relations
  const relationMap: Record<string, string[]> = {
    variants: [
      "variants.title",
      "variants.sku",
      "variants.options.value",
      "variants.options.option.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    categories: ["categories.name", "categories.handle"],
    collection: ["collection.title", "collection.handle"],
    tags: ["tags.value"],
    type: ["type.value"],
  }
  for (const [key, graphFields] of Object.entries(relationMap)) {
    if (mask.product.relations[key] !== false) {
      fields.push(...graphFields)
    }
  }

  // Custom modules — request all enabled fields via the linked entity name
  for (const mod of mask.custom_modules) {
    if (!mod.enabled) continue
    const enabledFields = Object.entries(mod.fields)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name)
    if (enabledFields.length > 0) {
      for (const f of enabledFields) {
        fields.push(`${mod.name}.${f}`)
      }
    }
  }

  return fields
}

function extractIds(data: { id?: string; ids?: string[] } | undefined): string[] {
  if (!data) return []
  if (Array.isArray(data.ids)) return data.ids.filter((x): x is string => !!x)
  if (typeof data.id === "string") return [data.id]
  return []
}
