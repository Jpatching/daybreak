#!/usr/bin/env node
/**
 * Daybreak MCP Server — stdio JSON-RPC 2.0
 *
 * Exposes deployer reputation scanning as MCP tools for AI agents.
 * Agents pay per-scan via x402 (USDC on Solana) automatically.
 *
 * Usage in claude_desktop_config.json or agent MCP config:
 * {
 *   "mcpServers": {
 *     "daybreak": {
 *       "command": "node",
 *       "args": ["path/to/dist/mcp-server.js"],
 *       "env": {
 *         "DAYBREAK_API_URL": "https://api.daybreakscan.com",
 *         "SOLANA_PRIVATE_KEY": "<base58 private key for USDC payments>"
 *       }
 *     }
 *   }
 * }
 */

const API_URL = process.env.DAYBREAK_API_URL || 'https://api.daybreakscan.com';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || '';

// ---------- JSON-RPC 2.0 helpers ----------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

function sendResponse(res: JsonRpcResponse): void {
  const json = JSON.stringify(res);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

function sendResult(id: string | number | null, result: any): void {
  sendResponse({ jsonrpc: '2.0', id, result });
}

function sendError(id: string | number | null, code: number, message: string, data?: any): void {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message, data } });
}

// ---------- x402 payment handling ----------

async function fetchWithX402(url: string): Promise<any> {
  // First attempt without payment
  const res = await fetch(url);

  if (res.status === 402) {
    // Parse x402 payment details
    const body = await res.json() as { price_usd?: number; details?: any };
    const details = body.details;

    if (!details?.accepts?.length) {
      throw new Error('402 Payment Required but no payment options provided');
    }

    if (!SOLANA_PRIVATE_KEY) {
      // Return the 402 info so the agent knows payment is needed
      return {
        error: 'payment_required',
        message: 'This scan requires USDC payment. Set SOLANA_PRIVATE_KEY env var to enable auto-payment.',
        price_usd: body.price_usd,
        payment_details: details,
      };
    }

    // Sign and pay via x402
    // Import tweetnacl dynamically for Ed25519 signing
    const nacl = await import('tweetnacl');
    const bs58 = await import('bs58');
    const { createHash, randomBytes } = await import('crypto');

    const secretKey = bs58.default.decode(SOLANA_PRIVATE_KEY);
    const publicKeyBytes = secretKey.length === 64 ? secretKey.slice(32) : nacl.default.sign.keyPair.fromSeed(secretKey).publicKey;
    const publicKey = bs58.default.encode(publicKeyBytes);

    const option = details.accepts[0];
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    const message = JSON.stringify({
      scheme: option.scheme,
      network: option.network,
      asset: option.asset,
      amount: option.maxAmountRequired,
      payTo: option.payTo,
      nonce,
      timestamp,
      validUntil: option.validUntil ?? timestamp + 300,
    });

    const messageBytes = new TextEncoder().encode(message);
    const messageHash = createHash('sha256').update(messageBytes).digest();

    const seed = secretKey.slice(0, 32);
    const keyPair = nacl.default.sign.keyPair.fromSeed(seed);
    const signatureBytes = nacl.default.sign.detached(new Uint8Array(messageHash), keyPair.secretKey);
    const signature = bs58.default.encode(signatureBytes);

    const payload = {
      paymentOption: option,
      signature,
      payer: publicKey,
      nonce,
      timestamp,
    };

    const paymentHeader = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Retry with payment
    const paidRes = await fetch(url, {
      headers: { 'X-PAYMENT': paymentHeader },
    });

    if (!paidRes.ok) {
      const errBody = await paidRes.json().catch(() => ({})) as any;
      throw new Error(`Payment failed (${paidRes.status}): ${errBody.error || 'Unknown error'}`);
    }

    return paidRes.json();
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as any;
    throw new Error(`API error (${res.status}): ${errBody.error || 'Unknown error'}`);
  }

  return res.json();
}

// ---------- MCP tool definitions ----------

const TOOLS = [
  {
    name: 'daybreak_scan_deployer',
    description: 'Scan a Solana token to analyze its deployer\'s reputation. Returns deployer wallet, rug rate, token history, funding cluster, risk signals, and a reputation score (0-100). Verdict: CLEAN / SUSPICIOUS / SERIAL_RUGGER. Costs $0.01 USDC per scan via x402.',
    inputSchema: {
      type: 'object',
      properties: {
        token_address: {
          type: 'string',
          description: 'Solana token mint address (base58)',
        },
      },
      required: ['token_address'],
    },
  },
  {
    name: 'daybreak_scan_wallet',
    description: 'Scan a Solana wallet to analyze its deployer reputation across all tokens it created via Pump.fun. Returns rug rate, token list, funding source, cluster analysis, and reputation score. Costs $0.01 USDC per scan via x402.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_address: {
          type: 'string',
          description: 'Solana wallet address (base58)',
        },
      },
      required: ['wallet_address'],
    },
  },
];

// ---------- MCP method handlers ----------

async function handleInitialize(id: string | number | null, params: any): Promise<void> {
  sendResult(id, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'daybreak',
      version: '1.0.0',
    },
  });
}

async function handleToolsList(id: string | number | null): Promise<void> {
  sendResult(id, { tools: TOOLS });
}

async function handleToolsCall(id: string | number | null, params: any): Promise<void> {
  const { name, arguments: args } = params;

  try {
    let result: any;

    if (name === 'daybreak_scan_deployer') {
      const { token_address } = args;
      if (!token_address || typeof token_address !== 'string') {
        sendError(id, -32602, 'Missing required parameter: token_address');
        return;
      }
      result = await fetchWithX402(`${API_URL}/api/v1/paid/deployer/${encodeURIComponent(token_address)}`);
    } else if (name === 'daybreak_scan_wallet') {
      const { wallet_address } = args;
      if (!wallet_address || typeof wallet_address !== 'string') {
        sendError(id, -32602, 'Missing required parameter: wallet_address');
        return;
      }
      result = await fetchWithX402(`${API_URL}/api/v1/paid/wallet/${encodeURIComponent(wallet_address)}`);
    } else {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }

    sendResult(id, {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    });
  } catch (err: any) {
    sendResult(id, {
      content: [
        {
          type: 'text',
          text: `Error: ${err.message}`,
        },
      ],
      isError: true,
    });
  }
}

// ---------- Message loop ----------

async function handleMessage(msg: JsonRpcRequest): Promise<void> {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      await handleInitialize(id ?? null, params);
      break;
    case 'initialized':
      // Notification, no response needed
      break;
    case 'tools/list':
      await handleToolsList(id ?? null);
      break;
    case 'tools/call':
      await handleToolsCall(id ?? null, params);
      break;
    case 'ping':
      sendResult(id ?? null, {});
      break;
    default:
      if (id !== undefined && id !== null) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

// ---------- stdio transport ----------

function startStdioTransport(): void {
  let buffer = '';

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;

    while (true) {
      // Try Content-Length framing first
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (match) {
          const contentLength = parseInt(match[1], 10);
          const bodyStart = headerEnd + 4;
          if (buffer.length < bodyStart + contentLength) break;

          const body = buffer.slice(bodyStart, bodyStart + contentLength);
          buffer = buffer.slice(bodyStart + contentLength);

          try {
            const msg = JSON.parse(body);
            handleMessage(msg).catch(err => {
              process.stderr.write(`Error handling message: ${err.message}\n`);
            });
          } catch (err: any) {
            process.stderr.write(`JSON parse error: ${err.message}\n`);
          }
          continue;
        }
      }

      // Fallback: try line-delimited JSON
      const lineEnd = buffer.indexOf('\n');
      if (lineEnd === -1) break;

      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);

      if (!line || line.startsWith('Content-Length')) continue;

      try {
        const msg = JSON.parse(line);
        handleMessage(msg).catch(err => {
          process.stderr.write(`Error handling message: ${err.message}\n`);
        });
      } catch {
        // Not valid JSON, skip
      }
    }
  });

  process.stderr.write('Daybreak MCP server started (stdio)\n');
}

startStdioTransport();
