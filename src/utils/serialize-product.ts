/**
 * Mirror of the canonical serializer at:
 *   api.nforce.ai/app/services/knowledge/medusa_product_serializer.ts
 *
 * Both must produce identical output so push (this plugin) and pull
 * (NForce-side syncMedusa) yield the same documents in the knowledge base.
 *
 * If you change one, change the other.
 */

interface MedusaPrice {
  amount?: number | null
  currency_code?: string | null
}

interface MedusaVariantOption {
  value?: string | null
  option?: { title?: string | null } | null
}

interface MedusaVariant {
  title?: string | null
  sku?: string | null
  options?: MedusaVariantOption[] | null
  prices?: MedusaPrice[] | null
}

interface MedusaCategory {
  name?: string | null
  handle?: string | null
}

interface MedusaCollection {
  title?: string | null
  handle?: string | null
}

interface MedusaTag {
  value?: string | null
}

export interface SerializableMedusaProduct {
  id: string
  title?: string | null
  subtitle?: string | null
  handle?: string | null
  description?: string | null
  status?: string | null
  material?: string | null
  type?: { value?: string | null } | null
  collection?: MedusaCollection | null
  categories?: MedusaCategory[] | null
  tags?: MedusaTag[] | null
  variants?: MedusaVariant[] | null
  metadata?: Record<string, unknown> | null
}

const formatPrice = (
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null => {
  if (amount === null || amount === undefined) return null
  // Medusa stores prices as integer minor units (cents)
  const major = (amount / 100).toFixed(2)
  return `${major} ${(currency || "USD").toUpperCase()}`
}

const formatVariantLine = (variant: MedusaVariant): string => {
  const optionLabel = (variant.options || [])
    .map((o) => o?.value)
    .filter((v): v is string => !!v)
    .join(" / ")

  const label = optionLabel || variant.title || "Default"

  const prices = (variant.prices || [])
    .map((p) => formatPrice(p.amount, p.currency_code))
    .filter((p): p is string => !!p)
    .join(", ")

  const sku = variant.sku ? ` (SKU: ${variant.sku})` : ""
  const priceStr = prices ? `  ${prices}` : ""
  return `  ${label}${priceStr}${sku}`
}

const flattenMetadata = (
  metadata: Record<string, unknown> | null | undefined
): string[] => {
  if (!metadata || typeof metadata !== "object") return []
  const lines: string[] = []
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined || value === "") continue
    if (typeof value === "object") continue
    lines.push(`${key}: ${value}`)
  }
  return lines
}

export function serializeMedusaProduct(product: SerializableMedusaProduct): string {
  const lines: string[] = []

  // Title row
  const titleParts: string[] = [product.title || product.handle || product.id]
  if (product.subtitle) titleParts.push(product.subtitle)
  lines.push(titleParts.join(" — "))

  // Status (only meaningful when not "published")
  if (product.status && product.status !== "published") {
    lines.push(`Status: ${product.status}`)
  }

  // Categories
  const categories = (product.categories || [])
    .map((c) => c?.name)
    .filter((n): n is string => !!n)
  if (categories.length) lines.push(`Categories: ${categories.join(" > ")}`)

  // Collection
  if (product.collection?.title) lines.push(`Collection: ${product.collection.title}`)

  // Type
  if (product.type?.value) lines.push(`Type: ${product.type.value}`)

  // Material
  if (product.material) lines.push(`Material: ${product.material}`)

  // Description
  if (product.description) {
    lines.push("")
    lines.push("Description:")
    lines.push(product.description)
  }

  // Variants
  const variants = product.variants || []
  if (variants.length) {
    lines.push("")
    lines.push("Variants:")
    for (const variant of variants) {
      lines.push(formatVariantLine(variant))
    }
  }

  // Tags
  const tags = (product.tags || []).map((t) => t?.value).filter((v): v is string => !!v)
  if (tags.length) {
    lines.push("")
    lines.push(`Tags: ${tags.join(", ")}`)
  }

  // Metadata (custom fields, scalar values only)
  const metadataLines = flattenMetadata(product.metadata)
  if (metadataLines.length) {
    lines.push("")
    for (const line of metadataLines) lines.push(line)
  }

  return lines.join("\n")
}
