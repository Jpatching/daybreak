use anyhow::{Context, Result};

/// ABI decoder for EVM return values
pub struct AbiDecoder;

impl AbiDecoder {
    /// Decode a uint256 from hex string into decimal string
    pub fn decode_uint256(hex: &str) -> Result<String> {
        let hex = hex.trim_start_matches("0x");

        // Handle empty or zero response
        if hex.is_empty() || hex.chars().all(|c| c == '0') {
            return Ok("0".to_string());
        }

        let trimmed = hex.trim_start_matches('0');
        if trimmed.is_empty() {
            return Ok("0".to_string());
        }

        // If it fits in u64, fast path
        if trimmed.len() <= 16 {
            let value = u64::from_str_radix(trimmed, 16).context("Failed to parse uint256")?;
            return Ok(value.to_string());
        }

        // For large numbers: convert hex to decimal using u128 chunks
        // Split into high and low 128-bit halves if needed
        if trimmed.len() <= 32 {
            let value =
                u128::from_str_radix(trimmed, 16).context("Failed to parse uint256 as u128")?;
            return Ok(value.to_string());
        }

        // For truly huge values (>128 bits), do manual hex-to-decimal
        Ok(Self::hex_to_decimal(trimmed))
    }

    /// Convert a hex string to decimal string for arbitrarily large numbers
    fn hex_to_decimal(hex: &str) -> String {
        // Start with result = [0]
        let mut result: Vec<u8> = vec![0];

        for ch in hex.chars() {
            let digit = ch.to_digit(16).unwrap_or(0) as u8;

            // Multiply result by 16
            let mut carry: u16 = 0;
            for d in result.iter_mut() {
                let val = (*d as u16) * 16 + carry;
                *d = (val % 10) as u8;
                carry = val / 10;
            }
            while carry > 0 {
                result.push((carry % 10) as u8);
                carry /= 10;
            }

            // Add the hex digit
            let mut carry: u16 = digit as u16;
            for d in result.iter_mut() {
                let val = (*d as u16) + carry;
                *d = (val % 10) as u8;
                carry = val / 10;
                if carry == 0 {
                    break;
                }
            }
            while carry > 0 {
                result.push((carry % 10) as u8);
                carry /= 10;
            }
        }

        // Result is stored least-significant-first, reverse it
        result.iter().rev().map(|d| (b'0' + d) as char).collect()
    }

    /// Decode a uint8 from hex string (for decimals)
    pub fn decode_uint8(hex: &str) -> Result<u8> {
        let hex = hex.trim_start_matches("0x");

        if hex.is_empty() {
            return Ok(0);
        }

        // decimals() returns 32 bytes, but value is in last byte
        let trimmed = hex.trim_start_matches('0');
        if trimmed.is_empty() {
            return Ok(0);
        }

        u8::from_str_radix(trimmed, 16).context("Failed to parse uint8")
    }

    /// Decode a string from ABI-encoded response
    /// Format: offset (32 bytes) + length (32 bytes) + data (padded to 32 bytes)
    pub fn decode_string(hex: &str) -> Result<String> {
        let hex = hex.trim_start_matches("0x");

        if hex.len() < 128 {
            // Might be a non-standard response, try to extract printable ASCII
            return Self::extract_ascii(hex);
        }

        // Skip offset (first 32 bytes = 64 hex chars)
        // Read length (next 32 bytes)
        let length_hex = &hex[64..128];
        let length =
            usize::from_str_radix(length_hex.trim_start_matches('0').max("0"), 16).unwrap_or(0);

        if length == 0 {
            return Ok(String::new());
        }

        // Read string data (after offset + length)
        let data_start = 128;
        let data_end = (data_start + length * 2).min(hex.len());
        let data_hex = &hex[data_start..data_end];

        // Convert hex to bytes to string
        let bytes: Vec<u8> = (0..data_hex.len())
            .step_by(2)
            .filter_map(|i| {
                if i + 2 <= data_hex.len() {
                    u8::from_str_radix(&data_hex[i..i + 2], 16).ok()
                } else {
                    None
                }
            })
            .collect();

        String::from_utf8(bytes).context("Failed to decode string as UTF-8")
    }

    /// Extract ASCII characters from hex (fallback for non-standard responses)
    fn extract_ascii(hex: &str) -> Result<String> {
        let bytes: Vec<u8> = (0..hex.len())
            .step_by(2)
            .filter_map(|i| {
                if i + 2 <= hex.len() {
                    u8::from_str_radix(&hex[i..i + 2], 16).ok()
                } else {
                    None
                }
            })
            .filter(|b| (0x20..0x7f).contains(b)) // Printable ASCII
            .collect();

        Ok(String::from_utf8_lossy(&bytes).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── uint8 ──────────────────────────────────────────────

    #[test]
    fn test_decode_uint8() {
        // Standard 32-byte padded response for decimals = 18
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000012";
        assert_eq!(AbiDecoder::decode_uint8(hex).unwrap(), 18);
    }

    #[test]
    fn test_decode_uint8_six() {
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000006";
        assert_eq!(AbiDecoder::decode_uint8(hex).unwrap(), 6);
    }

    #[test]
    fn test_decode_uint8_zero() {
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
        assert_eq!(AbiDecoder::decode_uint8(hex).unwrap(), 0);
    }

    #[test]
    fn test_decode_uint8_empty() {
        assert_eq!(AbiDecoder::decode_uint8("0x").unwrap(), 0);
        assert_eq!(AbiDecoder::decode_uint8("").unwrap(), 0);
    }

    // ── uint256 ────────────────────────────────────────────

    #[test]
    fn test_decode_uint256_zero() {
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
        assert_eq!(AbiDecoder::decode_uint256(hex).unwrap(), "0");
    }

    #[test]
    fn test_decode_uint256_small() {
        // 1000000 in hex = 0xF4240
        let hex = "0x00000000000000000000000000000000000000000000000000000000000f4240";
        assert_eq!(AbiDecoder::decode_uint256(hex).unwrap(), "1000000");
    }

    #[test]
    fn test_decode_uint256_u64_boundary() {
        // u64::MAX = 18446744073709551615 = 0xFFFFFFFFFFFFFFFF (16 hex chars)
        let hex = "0x000000000000000000000000000000000000000000000000ffffffffffffffff";
        assert_eq!(
            AbiDecoder::decode_uint256(hex).unwrap(),
            "18446744073709551615"
        );
    }

    #[test]
    fn test_decode_uint256_u128_range() {
        // A value that exceeds u64 but fits in u128
        // 10^20 = 100000000000000000000 = 0x56BC75E2D63100000 (17 hex chars)
        let hex = "0x0000000000000000000000000000000000000000000000056bc75e2d63100000";
        assert_eq!(
            AbiDecoder::decode_uint256(hex).unwrap(),
            "100000000000000000000"
        );
    }

    #[test]
    fn test_decode_uint256_large_hex_to_decimal() {
        // Exercises hex_to_decimal: value > 128 bits
        // 2^160 = 1461501637330902918203684832716283019655932542976
        // hex: 10000000000000000000000000000000000000000 (41 hex chars after trim)
        let hex = "0x0000000000000000000000010000000000000000000000000000000000000000";
        let result = AbiDecoder::decode_uint256(hex).unwrap();
        assert_eq!(result, "1461501637330902918203684832716283019655932542976");
    }

    // ── string ─────────────────────────────────────────────

    #[test]
    fn test_decode_string_standard() {
        // ABI-encoded "USDC": offset=0x20, length=4, data="USDC" padded
        let hex = "0x\
            0000000000000000000000000000000000000000000000000000000000000020\
            0000000000000000000000000000000000000000000000000000000000000004\
            5553444300000000000000000000000000000000000000000000000000000000";
        assert_eq!(AbiDecoder::decode_string(hex).unwrap(), "USDC");
    }

    #[test]
    fn test_decode_string_empty() {
        // ABI-encoded empty string: offset=0x20, length=0
        let hex = "0x\
            0000000000000000000000000000000000000000000000000000000000000020\
            0000000000000000000000000000000000000000000000000000000000000000";
        assert_eq!(AbiDecoder::decode_string(hex).unwrap(), "");
    }

    #[test]
    fn test_decode_string_short_fallback() {
        // Non-standard short response — triggers extract_ascii fallback
        // "MKR" in hex = 4d4b52
        let hex = "4d4b5200000000000000000000000000000000000000000000000000000000";
        let result = AbiDecoder::decode_string(hex).unwrap();
        assert!(result.contains("MKR"));
    }
}
