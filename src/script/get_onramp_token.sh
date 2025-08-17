# scripts/get_onramp_token.sh
#!/usr/bin/env bash
set -euo pipefail

# Read JSON data from stdin
DATA=$(cat)

cdpcurl -X POST 'https://api.developer.coinbase.com/onramp/v1/token' \
  -k "${1:-cdp_api_key.json}" \
  -d "$DATA"