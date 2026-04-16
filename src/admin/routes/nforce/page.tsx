import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  CodeBlock,
  Button,
  Switch,
  Tabs,
  toast,
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle,
  XCircle,
  ArrowUpRightOnBox,
  ArrowPath,
} from "@medusajs/icons"
import { useState, useEffect } from "react"
import { Input, Label } from "@medusajs/ui"

// ── Types ──────────────────────────────────────────────────────────

type NForceConfig = {
  configured: boolean
  api_url?: string
  source_id?: string
  has_field_mask?: boolean
}

type Agent = {
  id: number
  name: string
  avatar: string | null
  type: string | null
  email: string | null
  phone_number: string | null
  whatsapp_enabled: boolean
  widget_public_key: string | null
  widget_snippet: string | null
}

type DiscoveredField = {
  name: string
  type: string
  label: string
  default: boolean
}

type DiscoveredRelation = {
  name: string
  label: string
  default: boolean
}

type DiscoveredModule = {
  name: string
  label: string
  link_table: string
  fields: DiscoveredField[]
}

type DiscoveryResult = {
  product: {
    label: string
    fields: DiscoveredField[]
    relations: DiscoveredRelation[]
  }
  custom_modules: DiscoveredModule[]
}

type MedusaCategory = {
  id: string
  name: string
  handle: string
  parent_id: string | null
}

type FieldMask = {
  storefront_url: string | null
  category_ids: string[] | null
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
}

type SyncStatus = {
  configured?: boolean
  sync_status?: string
  sync_error?: string | null
  synced_at?: string | null
  document_count?: number
}

// ── Helpers ────────────────────────────────────────────────────────

const channelLabel = (agent: Agent): string => {
  switch (agent.type) {
    case "webchat":
      return "Web Chat"
    case "email":
      return "Email"
    case "whatsapp":
      return "WhatsApp"
    case "phone":
      return "Phone"
    default:
      return agent.type || "Agent"
  }
}

// ── Setup Wizard ───────────────────────────────────────────────────

const SetupWizard = ({
  onCancel,
}: {
  onCancel?: () => void
}) => {
  const queryClient = useQueryClient()
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [categories, setCategories] = useState<MedusaCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [mask, setMask] = useState<FieldMask | null>(null)

  // Load discovery data + existing field mask + categories
  useEffect(() => {
    Promise.all([
      fetch("/admin/nforce/discover", { credentials: "include" }).then((r) =>
        r.json()
      ),
      fetch("/admin/nforce/field-mask", { credentials: "include" }).then((r) =>
        r.json()
      ),
      fetch("/admin/nforce/categories", { credentials: "include" }).then((r) =>
        r.json()
      ),
    ]).then(([disc, existing, cats]) => {
      setDiscovery(disc as DiscoveryResult)
      setCategories((cats as any).categories || [])
      if (existing?.field_mask) {
        setMask(existing.field_mask)
      } else {
        // Build default mask from discovery defaults
        const d = disc as DiscoveryResult
        setMask({
          storefront_url: null,
          category_ids: null, // null = all categories
          product: {
            fields: Object.fromEntries(
              d.product.fields.map((f) => [f.name, f.default])
            ),
            relations: Object.fromEntries(
              d.product.relations.map((r) => [r.name, r.default])
            ),
          },
          custom_modules: d.custom_modules.map((m) => ({
            name: m.name,
            label: m.label,
            enabled: false,
            fields: Object.fromEntries(
              m.fields.map((f) => [f.name, f.default])
            ),
          })),
        })
      }
      setLoading(false)
    })
  }, [])

  const saveMutation = useMutation({
    mutationFn: (fieldMask: FieldMask) =>
      fetch("/admin/nforce/field-mask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldMask),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Save failed")
        return r.json()
      }),
    onSuccess: () => {
      toast.success("Settings saved")
      queryClient.invalidateQueries({ queryKey: ["nforce-field-mask"] })
      queryClient.invalidateQueries({ queryKey: ["nforce-config"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleProductField = (name: string) => {
    if (!mask) return
    setMask({
      ...mask,
      product: {
        ...mask.product,
        fields: { ...mask.product.fields, [name]: !mask.product.fields[name] },
      },
    })
  }

  const allCategoriesSelected =
    mask?.category_ids === null || mask?.category_ids === undefined

  const toggleCategory = (categoryId: string) => {
    if (!mask) return
    if (allCategoriesSelected) {
      // Switching from "all" to specific: select all except this one
      const allIds = categories.map((c) => c.id)
      setMask({
        ...mask,
        category_ids: allIds.filter((id) => id !== categoryId),
      })
    } else {
      const current = mask.category_ids || []
      if (current.includes(categoryId)) {
        setMask({
          ...mask,
          category_ids: current.filter((id) => id !== categoryId),
        })
      } else {
        const updated = [...current, categoryId]
        // If all categories selected again, switch back to null
        if (updated.length >= categories.length) {
          setMask({ ...mask, category_ids: null })
        } else {
          setMask({ ...mask, category_ids: updated })
        }
      }
    }
  }

  const toggleAllCategories = () => {
    if (!mask) return
    if (allCategoriesSelected) {
      setMask({ ...mask, category_ids: [] })
    } else {
      setMask({ ...mask, category_ids: null })
    }
  }

  const isCategorySelected = (categoryId: string): boolean => {
    if (allCategoriesSelected) return true
    return mask?.category_ids?.includes(categoryId) ?? false
  }

  const toggleProductRelation = (name: string) => {
    if (!mask) return
    setMask({
      ...mask,
      product: {
        ...mask.product,
        relations: {
          ...mask.product.relations,
          [name]: !mask.product.relations[name],
        },
      },
    })
  }

  const toggleModule = (moduleIdx: number) => {
    if (!mask) return
    const modules = [...mask.custom_modules]
    modules[moduleIdx] = {
      ...modules[moduleIdx],
      enabled: !modules[moduleIdx].enabled,
    }
    setMask({ ...mask, custom_modules: modules })
  }

  const toggleModuleField = (moduleIdx: number, fieldName: string) => {
    if (!mask) return
    const modules = [...mask.custom_modules]
    modules[moduleIdx] = {
      ...modules[moduleIdx],
      fields: {
        ...modules[moduleIdx].fields,
        [fieldName]: !modules[moduleIdx].fields[fieldName],
      },
    }
    setMask({ ...mask, custom_modules: modules })
  }

  if (loading || !discovery || !mask) {
    return (
      <Container className="p-0">
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Discovering modules...</Text>
        </div>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Medusa NForce Plugin</Heading>
            <Text className="text-ui-fg-subtle mt-1" size="small">
              Select which product data your AI agents should have access to.
            </Text>
          </div>
          <div className="flex gap-x-2 shrink-0">
            {onCancel && (
              <Button variant="secondary" size="small" onClick={onCancel}>
                Back
              </Button>
            )}
            <Button
              size="small"
              onClick={() => {
                if (!mask.storefront_url?.trim()) {
                  toast.error("Storefront URL is required")
                  return
                }
                saveMutation.mutate(mask)
              }}
              isLoading={saveMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="px-6 py-4">
          <Tabs defaultValue="general">
            <Tabs.List>
              <Tabs.Trigger value="general">General</Tabs.Trigger>
              <Tabs.Trigger value="categories">
                Categories
                {!allCategoriesSelected && (
                  <Badge color="blue" size="2xsmall" className="ml-1">
                    {mask.category_ids?.length || 0}
                  </Badge>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
            </Tabs.List>

            {/* General tab */}
            <Tabs.Content value="general">
              <div className="pt-4 flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-1">
                  <Label htmlFor="storefront_url">Storefront URL</Label>
                  <Input
                    id="storefront_url"
                    value={mask.storefront_url || ""}
                    placeholder="https://yourstore.com"
                    onChange={(e) =>
                      setMask({
                        ...mask,
                        storefront_url: e.target.value || null,
                      })
                    }
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Product links will be generated as{" "}
                    {mask.storefront_url || "https://yourstore.com"}
                    /products/&#123;handle&#125;
                  </Text>
                </div>
              </div>
            </Tabs.Content>

            {/* Categories tab */}
            <Tabs.Content value="categories">
              <div className="pt-4">
                {categories.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Text size="small" weight="plus">
                          All Categories
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {allCategoriesSelected
                            ? "All categories will be synced"
                            : `${mask.category_ids?.length || 0} of ${categories.length} selected`}
                        </Text>
                      </div>
                      <Switch
                        checked={allCategoriesSelected}
                        onCheckedChange={toggleAllCategories}
                      />
                    </div>
                    {!allCategoriesSelected && (
                      <div className="space-y-2 pl-2 border-l-2 border-ui-border-base ml-1">
                        {categories.map((cat) => (
                          <label
                            key={cat.id}
                            className="flex items-center justify-between py-1"
                          >
                            <Text size="small">{cat.name}</Text>
                            <Switch
                              checked={isCategorySelected(cat.id)}
                              onCheckedChange={() => toggleCategory(cat.id)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Text size="small" className="text-ui-fg-subtle py-2">
                    No product categories found.
                  </Text>
                )}
              </div>
            </Tabs.Content>

            {/* Fields tab */}
            <Tabs.Content value="fields">
              <div className="pt-4 divide-y">
                {/* Product core fields */}
                <div className="pb-4">
                  <Text size="small" weight="plus" className="mb-3">
                    Product Fields
                  </Text>
                  <div className="space-y-2">
                    {discovery.product.fields.map((field) => (
                      <label
                        key={field.name}
                        className="flex items-center justify-between py-1"
                      >
                        <Text size="small">{field.label}</Text>
                        <Switch
                          checked={mask.product.fields[field.name] ?? false}
                          onCheckedChange={() => toggleProductField(field.name)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Product relations */}
                <div className="py-4">
                  <Text size="small" weight="plus" className="mb-3">
                    Product Relations
                  </Text>
                  <div className="space-y-2">
                    {discovery.product.relations.map((rel) => (
                      <label
                        key={rel.name}
                        className="flex items-center justify-between py-1"
                      >
                        <Text size="small">{rel.label}</Text>
                        <Switch
                          checked={mask.product.relations[rel.name] ?? false}
                          onCheckedChange={() =>
                            toggleProductRelation(rel.name)
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom modules */}
                {discovery.custom_modules.map((mod, modIdx) => {
                  const moduleEnabled =
                    mask.custom_modules[modIdx]?.enabled ?? false
                  return (
                    <div key={mod.name} className="py-4">
                      <label className="flex items-center justify-between mb-3">
                        <Text size="small" weight="plus">
                          {mod.label}
                        </Text>
                        <Switch
                          checked={moduleEnabled}
                          onCheckedChange={() => toggleModule(modIdx)}
                        />
                      </label>
                      {moduleEnabled && (
                        <div className="space-y-2 pl-2 border-l-2 border-ui-border-base ml-1">
                          {mod.fields.map((field) => (
                            <label
                              key={field.name}
                              className="flex items-center justify-between py-1"
                            >
                              <div>
                                <Text size="small">{field.label}</Text>
                                <Text
                                  size="xsmall"
                                  className="text-ui-fg-muted"
                                >
                                  {field.type}
                                </Text>
                              </div>
                              <Switch
                                checked={
                                  mask.custom_modules[modIdx]?.fields[
                                    field.name
                                  ] ?? false
                                }
                                onCheckedChange={() =>
                                  toggleModuleField(modIdx, field.name)
                                }
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {discovery.custom_modules.length === 0 && (
                  <div className="py-4">
                    <Text size="small" className="text-ui-fg-subtle">
                      No custom modules linked to products were found.
                    </Text>
                  </div>
                )}
              </div>
            </Tabs.Content>
          </Tabs>
        </div>
      </Container>

    </div>
  )
}

// ── Status Page (post-setup) ───────────────────────────────────────

const StatusPage = ({
  config,
  onReconfigure,
}: {
  config: NForceConfig
  onReconfigure: () => void
}) => {
  const { data: statusData } = useQuery<SyncStatus>({
    queryKey: ["nforce-status"],
    queryFn: () =>
      fetch("/admin/nforce/status", { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !!config.configured,
    refetchInterval: (query) =>
      query.state.data?.sync_status === "syncing" ? 3000 : false,
  })

  const { data: agentsData, isPending: agentsLoading } = useQuery<{
    agents: Agent[]
  }>({
    queryKey: ["nforce-agents"],
    queryFn: () =>
      fetch("/admin/nforce/agents", { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !!config.configured,
  })

  const status = statusData
  const agents = agentsData?.agents || []
  const platformUrl =
    (config.api_url || "").replace(/\/api\/?$/, "") || "https://platform.nforce.ai"

  return (
    <div className="flex flex-col gap-y-4">
      {/* Status Card */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Medusa NForce Plugin</Heading>
            <Text className="text-ui-fg-subtle mt-1" size="small">
              Your product catalog is synced to NForce so AI agents can answer
              customer questions.
            </Text>
          </div>
          {config.configured ? (
            <Badge color="green">
              <CheckCircle className="inline mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge color="green">
              <CheckCircle className="inline mr-1" />
              Configured
            </Badge>
          )}
        </div>

        {config.configured && status && (
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-y-3 text-ui-fg-subtle">
              <Text size="small" weight="plus">
                Products synced
              </Text>
              <Text size="small">{status.document_count ?? "—"}</Text>

              <Text size="small" weight="plus">
                Last sync
              </Text>
              <Text size="small">
                {status.synced_at
                  ? new Date(status.synced_at).toLocaleString()
                  : "Never"}
              </Text>

              <Text size="small" weight="plus">
                Status
              </Text>
              {status.sync_status === "syncing" ? (
                <span className="inline-flex items-center gap-x-1 text-blue-500">
                  <ArrowPath className="w-3.5 h-3.5 animate-spin" />
                  <Text size="small" className="text-blue-500">
                    Syncing
                  </Text>
                </span>
              ) : status.sync_status === "idle" ? (
                <Text size="small" className="text-green-600">
                  Up to date
                </Text>
              ) : status.sync_status === "failed" ? (
                <Text size="small" className="text-red-500">
                  Failed
                </Text>
              ) : (
                <Text size="small">—</Text>
              )}

              {status.sync_error && (
                <>
                  <Text size="small" weight="plus">
                    Last error
                  </Text>
                  <Text size="small" className="text-ui-fg-error">
                    {status.sync_error}
                  </Text>
                </>
              )}
            </div>
          </div>
        )}

        {!config.configured && (
          <div className="px-6 py-4 flex flex-col gap-y-3">
            <Text size="small" className="text-ui-fg-subtle">
              Field mapping configured. Add a Medusa Commerce source to a
              knowledge base in NForce to activate.
            </Text>
            {platformUrl && (
              <a
                href={`${platformUrl}/settings/knowledge`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="small">
                  <ArrowUpRightOnBox className="mr-1" />
                  Open Knowledge Bases
                </Button>
              </a>
            )}
          </div>
        )}

        <div className="px-6 py-3 flex justify-end">
          <Button variant="secondary" size="small" onClick={onReconfigure}>
            Settings
          </Button>
        </div>
      </Container>

      {/* Agents Section */}
      {config.configured && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">AI Agents</Heading>
            <Text className="text-ui-fg-subtle mt-1" size="small">
              These NForce agents have access to your product catalog.
            </Text>
          </div>

          {agentsLoading ? (
            <div className="px-6 py-8">
              <Text className="text-ui-fg-subtle">Loading agents...</Text>
            </div>
          ) : agents.length === 0 ? (
            <div className="px-6 py-8 flex flex-col items-center gap-y-3">
              <Text className="text-ui-fg-subtle text-center">
                No agents are using your product catalog yet.
              </Text>
              {platformUrl && (
                <a
                  href={`${platformUrl}/agents/create`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="small">
                    <ArrowUpRightOnBox className="mr-1" />
                    Create an Agent
                  </Button>
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {agents.map((agent) => (
                <div key={agent.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-x-3">
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-ui-bg-subtle flex items-center justify-center text-ui-fg-subtle text-sm font-medium">
                          {agent.name?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div>
                        <Text size="small" weight="plus">
                          {agent.name}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {channelLabel(agent)}
                        </Text>
                      </div>
                    </div>
                    {platformUrl && (
                      <a
                        href={`${platformUrl}/agents/${agent.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="secondary" size="small">
                          <ArrowUpRightOnBox className="mr-1" />
                          Open in NForce
                        </Button>
                      </a>
                    )}
                  </div>

                  {agent.type === "webchat" && agent.widget_snippet && (
                    <div className="mt-2">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-subtle mb-1"
                      >
                        Chat Widget Snippet
                      </Text>
                      <CodeBlock
                        snippets={[
                          {
                            label: "HTML",
                            language: "html",
                            code: agent.widget_snippet,
                          },
                        ]}
                      >
                        <CodeBlock.Body />
                      </CodeBlock>
                    </div>
                  )}

                  {agent.type === "email" && agent.email && (
                    <div className="mt-2 flex items-center gap-x-2">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-subtle"
                      >
                        Email:
                      </Text>
                      <Text size="small">{agent.email}</Text>
                    </div>
                  )}

                  {agent.type === "whatsapp" && agent.phone_number && (
                    <div className="mt-2 flex items-center gap-x-2">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-subtle"
                      >
                        WhatsApp:
                      </Text>
                      <Text size="small">{agent.phone_number}</Text>
                    </div>
                  )}

                  {agent.type === "phone" && agent.phone_number && (
                    <div className="mt-2 flex items-center gap-x-2">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-subtle"
                      >
                        Phone:
                      </Text>
                      <Text size="small">{agent.phone_number}</Text>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Container>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────

const NForcePage = () => {
  const queryClient = useQueryClient()
  const [showSetup, setShowSetup] = useState(false)

  const { data: configData, isPending: configLoading } =
    useQuery<NForceConfig>({
      queryKey: ["nforce-config"],
      queryFn: () =>
        fetch("/admin/nforce", { credentials: "include" }).then((r) =>
          r.json()
        ),
    })

  const { data: maskData, isPending: maskLoading } = useQuery<{
    field_mask: any
  }>({
    queryKey: ["nforce-field-mask"],
    queryFn: () =>
      fetch("/admin/nforce/field-mask", { credentials: "include" }).then((r) =>
        r.json()
      ),
  })

  const hasFieldMask = !!maskData?.field_mask
  const isLoading = configLoading || maskLoading

  if (isLoading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      </Container>
    )
  }

  // Show setup wizard if no field mask or user clicked reconfigure
  if (!hasFieldMask || showSetup) {
    return (
      <SetupWizard
        onCancel={hasFieldMask ? () => setShowSetup(false) : undefined}
      />
    )
  }

  // Show status page
  return (
    <StatusPage
      config={configData!}
      onReconfigure={() => setShowSetup(true)}
    />
  )
}

export const config = defineRouteConfig({
  label: "NForce",
})

export default NForcePage
