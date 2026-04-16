import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, CodeBlock, Button } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, XCircle, ArrowUpRightOnBox, ArrowPath } from "@medusajs/icons"

type NForceConfig = {
  configured: boolean
  api_url?: string
  source_id?: string
  last_synced_at?: string | null
  last_sync_status?: string | null
  last_sync_error?: string | null
  document_count?: number
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

const NForcePage = () => {
  const { data: configData, isPending: configLoading } =
    useQuery<NForceConfig>({
      queryKey: ["nforce-config"],
      queryFn: () =>
        fetch("/admin/nforce", { credentials: "include" }).then((r) =>
          r.json()
        ),
    })

  const { data: statusData } = useQuery<{
    configured?: boolean
    sync_status?: string
    sync_error?: string | null
    synced_at?: string | null
    document_count?: number
  }>({
    queryKey: ["nforce-status"],
    queryFn: () =>
      fetch("/admin/nforce/status", { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !!configData?.configured,
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
    enabled: !!configData?.configured,
  })

  const config = configData
  const status = statusData
  const agents = agentsData?.agents || []
  // Derive platform URL from api_url (e.g. "https://platform.nforce.ai/api" → "https://platform.nforce.ai")
  const platformUrl = (config?.api_url || "").replace(/\/api\/?$/, "")

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
          {config?.configured ? (
            <Badge color="green">
              <CheckCircle className="inline mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge color="grey">
              <XCircle className="inline mr-1" />
              Not configured
            </Badge>
          )}
        </div>

        {configLoading ? (
          <div className="px-6 py-8">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        ) : config?.configured ? (
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-y-3 text-ui-fg-subtle">
              <Text size="small" weight="plus">
                Documents synced
              </Text>
              <Text size="small">{status?.document_count ?? "—"}</Text>

              <Text size="small" weight="plus">
                Last sync
              </Text>
              <Text size="small">
                {status?.synced_at
                  ? new Date(status.synced_at).toLocaleString()
                  : "Never"}
              </Text>

              <Text size="small" weight="plus">
                Status
              </Text>
              {status?.sync_status === "syncing" ? (
                <span className="inline-flex items-center gap-x-1 text-blue-500">
                  <ArrowPath className="w-3.5 h-3.5 animate-spin" />
                  <Text size="small" className="text-blue-500">Syncing</Text>
                </span>
              ) : status?.sync_status === "idle" ? (
                <Text size="small" className="text-green-600">Up to date</Text>
              ) : status?.sync_status === "failed" ? (
                <Text size="small" className="text-red-500">Failed</Text>
              ) : (
                <Text size="small">—</Text>
              )}

              {status?.sync_error && (
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
        ) : null}
      </Container>

      {/* Agents Section */}
      {config?.configured && (
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
                  </div>

                  {/* Webchat: widget snippet */}
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

                  {/* Email: show address */}
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

                  {/* WhatsApp: show phone number */}
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

                  {/* Phone: show phone number */}
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

      {/* Getting Started */}
      {!configLoading && !config?.configured && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">Getting Started</Heading>
          </div>
          <div className="px-6 py-4">
            <ol className="list-decimal list-inside space-y-3 text-ui-fg-subtle">
              <li>
                <Text size="small" as="span">
                  Sign up at{" "}
                  <a
                    href={platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ui-fg-interactive hover:underline"
                  >
                    platform.nforce.ai
                  </a>
                </Text>
              </li>
              <li>
                <Text size="small" as="span">
                  Go to <strong>Settings → Connections</strong> and create a{" "}
                  <strong>Medusa Commerce</strong> connection with your store URL
                  and admin API key
                </Text>
              </li>
              <li>
                <Text size="small" as="span">
                  Create a <strong>Knowledge Base</strong> and add a{" "}
                  <strong>Medusa Commerce</strong> source — select your
                  connection
                </Text>
              </li>
              <li>
                <Text size="small" as="span">
                  NForce will automatically configure this plugin and sync your
                  product catalog
                </Text>
              </li>
              <li>
                <Text size="small" as="span">
                  Assign the knowledge base to an agent — it can now answer
                  questions about your products
                </Text>
              </li>
            </ol>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "NForce",
})

export default NForcePage
