# medusa-plugin-nforce

Real-time product sync from a [Medusa v2](https://medusajs.com) store to an [NForce](https://nforce.ai) knowledge base.

When products are created, updated, or deleted in your Medusa store, the plugin serializes the full product graph (variants, prices, options, categories, collection, tags, metadata) and pushes it to a configured NForce knowledge source. The NForce side chunks, embeds, and indexes the document so AI agents can answer customer questions about your catalog.

## Install

**From npm** (once published):

```bash
yarn add medusa-plugin-nforce
```

**Local development** (before publishing):

```bash
# 1. In the plugin directory — install deps, build, and publish to local Yalc registry
cd medusa-plugin-nforce
yarn install
yarn build
yarn publish:local

# 2. In your Medusa project — add from local registry
cd your-medusa-project
yarn medusa plugin:add medusa-plugin-nforce

# 3. For live reload during development (in the plugin directory)
cd medusa-plugin-nforce
yarn medusa plugin:develop
```

Then add it to your `medusa-config.ts`:

```ts
module.exports = defineConfig({
  // ...
  plugins: [
    {
      resolve: "medusa-plugin-nforce",
      options: {},
    },
  ],
})
```

Run migrations:

```bash
npx medusa db:migrate
```

## Setup

The plugin is **zero-config on the Medusa side**. Setup happens entirely from the NForce platform:

1. In NForce, create a **Medusa Commerce** connection (store URL + admin API key)
2. Add a **Medusa Commerce** source to a knowledge base, selecting that connection
3. NForce automatically pushes config to the plugin and triggers an initial sync

That's it. The plugin starts receiving real-time product events immediately.

## How it works

```
NForce adds medusa source
          ↓
NForce calls POST {storeUrl}/admin/nforce/setup
  → pushes { push_url, plugin_token } to the plugin
          ↓
NForce triggers initial sync (pull all products via Admin API)
          ↓
Plugin receives config, starts subscribing to product events
          ↓
On product.created/updated/deleted:
  → plugin serializes product via query.graph()
  → POSTs to NForce webhook: {push_url} with X-Plugin-Token header
          ↓
NForce: chunk → contextual enrichment → embed → store
  → agents can search the catalog immediately
```

## License

MIT
