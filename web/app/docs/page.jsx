export const metadata = {
  title: 'API Documentation',
  description:
    'Complete API reference for the Daybreak deployer reputation scanner. Authentication, endpoints, rate limits, and x402 paid access.',
  alternates: { canonical: '/docs' },
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2 text-white">API Documentation</h1>
          <p className="text-slate-400 text-center mb-12">
            Complete reference for the Daybreak deployer reputation API.
          </p>

          <div className="prose prose-invert prose-amber max-w-none prose-headings:font-semibold prose-a:text-amber-400 prose-code:text-amber-400 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700">

            <h2>Overview</h2>
            <p>
              The Daybreak API provides deployer reputation scanning for Solana tokens. It analyzes
              a token's deployer wallet, calculates a reputation score, and returns detailed data
              about rug rate, funding clusters, and token risks.
            </p>
            <p>
              Base URL: <code>https://api.daybreakscan.com/api/v1</code>
            </p>

            <h2>Authentication</h2>
            <p>Protected endpoints require a JWT obtained through wallet signature verification:</p>

            <h3>Step 1: Request a Nonce</h3>
            <pre><code>{`GET /auth/nonce?wallet=YOUR_WALLET_ADDRESS

Response:
{
  "nonce": "daybreak-auth-1708300000-abc123..."
}`}</code></pre>

            <h3>Step 2: Sign the Nonce</h3>
            <p>
              Sign the nonce string with your Solana wallet (ed25519). Encode the signature as base58.
            </p>

            <h3>Step 3: Verify and Get JWT</h3>
            <pre><code>{`POST /auth/verify
Content-Type: application/json

{
  "wallet": "YOUR_WALLET_ADDRESS",
  "signature": "BASE58_ENCODED_SIGNATURE",
  "message": "THE_NONCE_STRING"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}`}</code></pre>

            <h3>Using the JWT</h3>
            <p>Include the JWT in the Authorization header:</p>
            <pre><code>{`Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`}</code></pre>
            <p>Tokens expire after 24 hours. Nonces expire after 5 minutes.</p>

            <h2>Endpoints</h2>

            <h3>Health Check</h3>
            <pre><code>{`GET /health

Response:
{
  "status": "ok",
  "helius": true,
  "version": "1.0.0"
}`}</code></pre>

            <h3>Scan Token (by token address)</h3>
            <pre><code>{`GET /deployer/:token_address
Authorization: Bearer <jwt>

Response:
{
  "token": { "name": "...", "symbol": "...", "address": "..." },
  "deployer": {
    "wallet": "...",
    "tokens_created": 12,
    "tokens_dead": 3,
    "death_rate": 0.25,
    "reputation_score": 72,
    "tokens": [...]
  },
  "verdict": "CLEAN",
  "funding": {
    "source_wallet": "...",
    "other_deployers_funded": 0,
    "cluster_total_tokens": 12
  },
  "token_risks": {
    "mint_authority": null,
    "freeze_authority": null,
    "deployer_holdings_pct": 0.5,
    "top_holder_pct": 12.3,
    "bundle_detected": false
  },
  "score_breakdown": { ... },
  "scanned_at": "2026-02-18T12:00:00Z"
}`}</code></pre>

            <h3>Scan Wallet (direct wallet scan)</h3>
            <pre><code>{`GET /wallet/:wallet_address
Authorization: Bearer <jwt>

Returns the same structure without token-specific data.`}</code></pre>

            <h3>Check Usage</h3>
            <pre><code>{`GET /auth/usage
Authorization: Bearer <jwt>

Response:
{
  "scans_used": 1,
  "scans_limit": 3,
  "scans_remaining": 2
}`}</code></pre>

            <h2>Rate Limits</h2>
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Limit</th>
                  <th>Auth</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Guest</td>
                  <td>1 scan/day (by IP)</td>
                  <td>None</td>
                </tr>
                <tr>
                  <td>Free</td>
                  <td>3 scans/day (per wallet)</td>
                  <td>JWT</td>
                </tr>
                <tr>
                  <td>Paid (x402)</td>
                  <td>Unlimited</td>
                  <td>X-PAYMENT header</td>
                </tr>
                <tr>
                  <td>Bot</td>
                  <td>Unlimited</td>
                  <td>X-Bot-Key header</td>
                </tr>
              </tbody>
            </table>
            <p>Cached results (30 min TTL) do not count against rate limits.</p>

            <h2>x402 Paid Access</h2>
            <p>
              The <code>/paid/*</code> endpoints accept x402 payments — $0.01 USDC per scan on Solana.
              No JWT required. Send an <code>X-PAYMENT</code> header with a base64-encoded JSON payload
              containing the payment option, wallet signature, payer address, nonce, and timestamp.
            </p>

            <h3>Paid Endpoints</h3>
            <pre><code>{`GET /paid/deployer/:token_address
GET /paid/wallet/:wallet_address

Header: X-PAYMENT: <base64-encoded-payment-payload>`}</code></pre>

            <h3>Payment Stats</h3>
            <pre><code>{`GET /x402/stats (public)

Response:
{
  "total_payments": 42,
  "total_revenue_usd": 0.42
}`}</code></pre>

            <h2>MCP Server</h2>
            <p>
              Daybreak includes an MCP (Model Context Protocol) server for AI agent integration.
              It exposes two tools: <code>daybreak_scan_deployer</code> and <code>daybreak_scan_wallet</code>.
            </p>
            <pre><code>{`# Run the MCP server
node dist/mcp-server.js

# Configure in your MCP client:
{
  "mcpServers": {
    "daybreak": {
      "command": "node",
      "args": ["path/to/dist/mcp-server.js"]
    }
  }
}`}</code></pre>

            <h2>Response Codes</h2>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>200</td><td>Success</td></tr>
                <tr><td>401</td><td>Missing or invalid JWT</td></tr>
                <tr><td>402</td><td>Rate limit reached — x402 payment required</td></tr>
                <tr><td>404</td><td>Token not found</td></tr>
                <tr><td>429</td><td>Rate limited</td></tr>
                <tr><td>503</td><td>Backend temporarily unavailable</td></tr>
              </tbody>
            </table>

            <h2>Curl Examples</h2>
            <pre><code>{`# Health check
curl https://api.daybreakscan.com/api/v1/health

# Get nonce
curl "https://api.daybreakscan.com/api/v1/auth/nonce?wallet=YOUR_WALLET"

# Scan a token (with JWT)
curl -H "Authorization: Bearer YOUR_JWT" \\
  https://api.daybreakscan.com/api/v1/deployer/TOKEN_ADDRESS

# Check usage
curl -H "Authorization: Bearer YOUR_JWT" \\
  https://api.daybreakscan.com/api/v1/auth/usage`}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
}
