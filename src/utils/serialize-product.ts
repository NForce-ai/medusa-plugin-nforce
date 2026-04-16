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
  const formatted = typeof amount === "number" ? amount.toFixed(2) : String(amount)
  return `${formatted} ${(currency || "USD").toUpperCase()}`
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

export type FieldMask = {
  storefront_url: string | null // e.g. "https://raptclothing.com" — product URLs: {storefront_url}/products/{handle}
  category_ids: string[] | null // null = all categories, array = only these
  product: {
    fields: Record<string, boolean>
    relations: Record<string, boolean>
  }
  custom_modules: {
    name: string
    label: string
    enabled: boolean
    fields: Record<string, boolean>
  }[]
} | null

const isEnabled = (mask: FieldMask, section: "fields" | "relations", name: string): boolean => {
  if (!mask) return true // No mask = include everything (backwards compatible)
  const map = section === "fields" ? mask.product.fields : mask.product.relations
  return map[name] !== false // Default to true if key missing
}

const isModuleFieldEnabled = (mask: FieldMask, moduleName: string, fieldName: string): boolean => {
  if (!mask) return true
  const mod = mask.custom_modules.find((m) => m.name === moduleName)
  if (!mod) return false // Module not in mask = skip entirely
  return mod.fields[fieldName] !== false
}

export function serializeMedusaProduct(
  product: SerializableMedusaProduct,
  mask?: FieldMask,
): string {
  const m = mask ?? null
  const lines: string[] = []

  // Title row (always included — it's the document identity)
  const titleParts: string[] = [product.title || product.handle || product.id]
  if (isEnabled(m, "fields", "subtitle") && product.subtitle) {
    titleParts.push(product.subtitle)
  }
  lines.push(titleParts.join(" — "))

  // Product URL
  if (m?.storefront_url && product.handle) {
    const base = m.storefront_url.replace(/\/$/, "")
    lines.push(`URL: ${base}/products/${product.handle}`)
  }

  // Status
  if (isEnabled(m, "fields", "status") && product.status && product.status !== "published") {
    lines.push(`Status: ${product.status}`)
  }

  // Categories
  if (isEnabled(m, "relations", "categories")) {
    const categories = (product.categories || [])
      .map((c) => c?.name)
      .filter((n): n is string => !!n)
    if (categories.length) lines.push(`Categories: ${categories.join(" > ")}`)
  }

  // Collection
  if (isEnabled(m, "relations", "collection") && product.collection?.title) {
    lines.push(`Collection: ${product.collection.title}`)
  }

  // Type
  if (isEnabled(m, "relations", "type") && product.type?.value) {
    lines.push(`Type: ${product.type.value}`)
  }

  // Material
  if (isEnabled(m, "fields", "material") && product.material) {
    lines.push(`Material: ${product.material}`)
  }

  // Handle
  if (isEnabled(m, "fields", "handle") && product.handle) {
    lines.push(`Handle: ${product.handle}`)
  }

  // Description
  if (isEnabled(m, "fields", "description") && product.description) {
    lines.push("")
    lines.push("Description:")
    lines.push(product.description)
  }

  // Variants
  if (isEnabled(m, "relations", "variants")) {
    const variants = product.variants || []
    if (variants.length) {
      lines.push("")
      lines.push("Variants:")
      for (const variant of variants) {
        lines.push(formatVariantLine(variant))
      }
    }
  }

  // Tags
  if (isEnabled(m, "relations", "tags")) {
    const tags = (product.tags || []).map((t) => t?.value).filter((v): v is string => !!v)
    if (tags.length) {
      lines.push("")
      lines.push(`Tags: ${tags.join(", ")}`)
    }
  }

  // Metadata
  if (isEnabled(m, "fields", "metadata")) {
    const metadataLines = flattenMetadata(product.metadata)
    if (metadataLines.length) {
      lines.push("")
      for (const line of metadataLines) lines.push(line)
    }
  }

  // Custom modules — each appears as a named section with enabled fields
  if (m?.custom_modules) {
    for (const mod of m.custom_modules) {
      if (!mod.enabled) continue

      const moduleData = (product as Record<string, any>)[mod.name]
      if (!moduleData || typeof moduleData !== "object") continue

      const enabledFields = Object.entries(mod.fields)
        .filter(([_, enabled]) => enabled)
        .map(([fieldName]) => fieldName)

      if (enabledFields.length === 0) continue

      const fieldLines: string[] = []
      for (const fieldName of enabledFields) {
        const value = moduleData[fieldName]
        if (value === null || value === undefined || value === "") continue
        if (typeof value === "object") continue
        fieldLines.push(`${snakeToLabel(fieldName)}: ${value}`)
      }

      if (fieldLines.length > 0) {
        lines.push("")
        lines.push(`${mod.label}:`)
        for (const line of fieldLines) lines.push(`  ${line}`)
      }
    }
  }

  return lines.join("\n")
}

function snakeToLabel(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
