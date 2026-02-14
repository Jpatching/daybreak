use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Low-level EVM JSON-RPC client
pub struct EvmRpcClient {
    client: Client,
    url: String,
}

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: &'static str,
    params: Value,
    id: u64,
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    result: Option<Value>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct JsonRpcError {
    message: String,
}

impl EvmRpcClient {
    pub fn new(url: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.to_string(),
        }
    }

    /// Make a raw JSON-RPC call
    async fn call(&self, method: &'static str, params: Value) -> Result<Value> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            method,
            params,
            id: 1,
        };

        let response = self
            .client
            .post(&self.url)
            .json(&request)
            .send()
            .await
            .context("Failed to send RPC request")?;

        let rpc_response: JsonRpcResponse = response
            .json()
            .await
            .context("Failed to parse RPC response")?;

        if let Some(error) = rpc_response.error {
            anyhow::bail!("RPC error: {}", error.message);
        }

        rpc_response.result.context("No result in RPC response")
    }

    /// Execute eth_call to read contract data
    pub async fn eth_call(&self, to: &str, data: &str) -> Result<String> {
        let params = json!([
            {
                "to": to,
                "data": data
            },
            "latest"
        ]);

        let result = self.call("eth_call", params).await?;
        result
            .as_str()
            .map(|s| s.to_string())
            .context("eth_call result is not a string")
    }

    /// Get contract bytecode
    pub async fn get_code(&self, address: &str) -> Result<String> {
        let params = json!([address, "latest"]);
        let result = self.call("eth_getCode", params).await?;
        result
            .as_str()
            .map(|s| s.to_string())
            .context("eth_getCode result is not a string")
    }

    /// Read storage slot at a given position
    pub async fn get_storage_at(&self, address: &str, slot: &str) -> Result<String> {
        let params = json!([address, slot, "latest"]);
        let result = self.call("eth_getStorageAt", params).await?;
        result
            .as_str()
            .map(|s| s.to_string())
            .context("eth_getStorageAt result is not a string")
    }

    /// Get EIP-1967 implementation address from storage slot
    /// Slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
    pub async fn get_eip1967_implementation(&self, proxy_address: &str) -> Result<Option<String>> {
        const EIP1967_IMPL_SLOT: &str =
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

        let storage = self.get_storage_at(proxy_address, EIP1967_IMPL_SLOT).await?;

        // Storage returns 32 bytes, address is last 20 bytes
        // If all zeros, no implementation set
        let storage = storage.trim_start_matches("0x");
        if storage.chars().all(|c| c == '0') {
            return Ok(None);
        }

        // Extract address from last 40 hex chars (20 bytes)
        if storage.len() >= 40 {
            let addr = &storage[storage.len() - 40..];
            Ok(Some(format!("0x{}", addr)))
        } else {
            Ok(None)
        }
    }
}
