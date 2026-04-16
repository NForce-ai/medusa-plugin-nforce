# medusa-plugin-nforce

[![npm version](https://img.shields.io/npm/v/medusa-plugin-nforce.svg)](https://www.npmjs.com/package/medusa-plugin-nforce)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Real-time product sync from a [Medusa v2](https://medusajs.com) store to an [NForce](https://nforce.ai) knowledge base.

When products are created, updated, or deleted in your Medusa store, the plugin serializes the full product graph (variants, prices, options, categories, collection, tags, custom modules) and pushes it to a configured NForce knowledge source. The NForce side chunks, embeds, and indexes the document so AI agents can answer customer questions about your catalog.

## Install

```bash
yarn add medusa-plugin-nforce
```

Add it to your `medusa-config.ts`:

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

### 1. Configure the plugin (Medusa admin)

Open your Medusa admin and navigate to **NForce** in the sidebar. The setup wizard has three tabs:

- **General** — Enter your storefront URL (e.g. `https://yourstore.com`). Product links will be generated as `{storefront_url}/products/{handle}`.
- **Categories** — Choose which product categories to sync. All categories are included by default; toggle off to exclude specific ones.
- **Fields** — Select which product fields, relations, and custom modules to include in the knowledge base. Custom modules linked to products (e.g. Brand, Supplier, custom pricing data) are auto-discovered and can be enabled individually.

Click **Save** when done.

### 2. Connect from NForce

In the NForce platform:

1. Go to **Settings → Connections** and create a **Medusa Commerce** connection with your store URL and admin API key (`sk_...`).
2. Go to a **Knowledge Base** and add a **Medusa Commerce** source, selecting your connection.
3. NForce validates the plugin is installed and configured, then triggers an initial sync.

That's it. The plugin starts receiving real-time product events immediately.

### 3. Agent toolkit (optional)

For live customer and order lookups, activate the **Medusa Commerce** toolkit on your NForce agent. This gives the agent three tools:

- **Search Customers** — find customers by name, email, or phone
- **Get Customer Orders** — retrieve order history for a customer
- **Get Order** — full order details including items, payment status, fulfillment, and shipping

The toolkit uses the same Medusa connection and works independently of the knowledge sync.

## Security

All NForce requests to your Medusa store go through the plugin's `/admin/nforce/*` routes — no direct access to the standard Admin API is needed.

If your store is behind a firewall or CDN with IP restrictions, whitelist NForce's egress IP for:

```
/admin/nforce/*
```

Contact **support@nforce.ai** to get the IP address(es) for your NForce instance.

## How it works

```
Medusa admin → NForce sidebar → configure fields/categories
                    ↓
NForce adds Medusa source → validates plugin → calls POST /admin/nforce/setup
                    ↓
NForce pulls all products via Admin API → serializes with field mask → stores in KB
                    ↓
Plugin receives config, starts subscribing to product events
                    ↓
On product.created/updated/deleted:
  → plugin fetches product via query.graph() (respects field mask + categories)
  → serializes with storefront URL, custom module data
  → POSTs to NForce webhook with X-Plugin-Token header
                    ↓
NForce: chunk → contextual enrichment → embed → store
  → agents can search the catalog immediately
```

## Plugin admin page

After setup, the NForce page in your Medusa admin shows:

- **Status** — connection state, document count, sync status with live indicator
- **AI Agents** — NForce agents using your product catalog, with channel info (chat widget snippet, email address, WhatsApp/phone number) and links to configure them in NForce
- **Settings** — reconfigure field mask, categories, or storefront URL at any time

## License

MIT
