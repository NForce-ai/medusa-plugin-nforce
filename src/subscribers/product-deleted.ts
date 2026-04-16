import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NFORCE_MODULE } from "../modules/nforce"
import type NForceModuleService from "../modules/nforce/service"

/**
 * Subscribes to product.deleted. Pushes a delete instruction to NForce
 * so the document is marked deleted on the knowledge-base side.
 */
export default async function productDeletedHandler({
  event,
  container,
}: SubscriberArgs<{ id?: string; ids?: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const nforce = container.resolve(NFORCE_MODULE) as NForceModuleService

  const config = await nforce.getConfig()
  if (!config) return

  const ids = extractIds(event.data)
  if (ids.length === 0) return

  for (const id of ids) {
    try {
      await nforce.pushDocument({ external_id: id, action: "delete" })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`NForce delete failed for product ${id}: ${message}`)
    }
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
  context: {
    subscriberId: "nforce-product-deleted",
  },
}

function extractIds(data: { id?: string; ids?: string[] } | undefined): string[] {
  if (!data) return []
  if (Array.isArray(data.ids)) return data.ids.filter((x): x is string => !!x)
  if (typeof data.id === "string") return [data.id]
  return []
}
