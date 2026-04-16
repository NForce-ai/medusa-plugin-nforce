import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/nforce/discover
 *
 * Discovers product-linked modules and their fields by inspecting the
 * database schema. Returns a field tree for the setup wizard:
 *
 * {
 *   product: { label, fields: [{ name, type, label }] },
 *   custom_modules: [{ name, label, table, fields: [{ name, type, label }] }]
 * }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  try {
    // Standard product fields (always available)
    const productFields = [
      { name: "title", type: "text", label: "Title", default: true },
      { name: "subtitle", type: "text", label: "Subtitle", default: true },
      { name: "description", type: "text", label: "Description", default: true },
      { name: "handle", type: "text", label: "Handle", default: false },
      { name: "material", type: "text", label: "Material", default: true },
      { name: "status", type: "text", label: "Status", default: false },
      { name: "metadata", type: "jsonb", label: "Metadata", default: false },
    ]

    const productRelations = [
      { name: "variants", label: "Variants & Prices", default: true },
      { name: "categories", label: "Categories", default: true },
      { name: "collection", label: "Collection", default: true },
      { name: "tags", label: "Tags", default: true },
      { name: "type", label: "Product Type", default: true },
    ]

    // Discover custom modules linked to products via link tables.
    // Link tables follow the convention: *_link with a product_id column.
    const linkTablesResult = await pgConnection.raw(`
      SELECT t.table_name
      FROM information_schema.tables t
      JOIN information_schema.columns c ON c.table_name = t.table_name
        AND c.table_schema = t.table_schema
      WHERE t.table_schema = 'public'
        AND t.table_name LIKE '%_link'
        AND c.column_name = 'product_id'
    `)

    const linkTables: string[] = (linkTablesResult.rows || []).map(
      (r: any) => r.table_name
    )

    // For each link table, find the "other" entity (not product) by looking
    // at columns ending in _id that aren't product_id, id, created_at, etc.
    const customModules: any[] = []

    for (const linkTable of linkTables) {
      // Find the foreign key column that points to the custom entity
      const colsResult = await pgConnection.raw(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ?
          AND column_name LIKE '%_id'
          AND column_name NOT IN ('product_id', 'id')
        ORDER BY ordinal_position
      `, [linkTable])

      const fkColumns: string[] = (colsResult.rows || []).map(
        (r: any) => r.column_name as string
      )

      for (const fkCol of fkColumns) {
        // Derive the entity table name from the FK column
        // e.g. "product_custom_data_id" → "product_custom_data"
        const entityTable = fkCol.replace(/_id$/, "")

        // Check if this table exists
        const tableExistsResult = await pgConnection.raw(`
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ?
        `, [entityTable])

        if (!tableExistsResult.rows?.length) continue

        // Get the entity's columns
        const entityColsResult = await pgConnection.raw(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ?
            AND column_name NOT IN ('id', 'created_at', 'updated_at', 'deleted_at', 'raw_price_low', 'raw_price_high', 'raw_our_cost')
          ORDER BY ordinal_position
        `, [entityTable])

        const fields = (entityColsResult.rows || []).map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          label: snakeToLabel(col.column_name),
          nullable: col.is_nullable === "YES",
          default: true,
        }))

        if (fields.length > 0) {
          customModules.push({
            name: entityTable,
            label: snakeToLabel(entityTable),
            link_table: linkTable,
            fields,
          })
        }
      }
    }

    res.json({
      product: {
        label: "Product",
        fields: productFields,
        relations: productRelations,
      },
      custom_modules: customModules,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Discovery failed: ${message}` })
  }
}

/** Convert snake_case to Title Case label */
function snakeToLabel(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
