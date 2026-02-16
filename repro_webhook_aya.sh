#!/bin/bash

# Configuration
WEBHOOK_URL="https://ai-visionary.com/api/webhooks/checkout-success"
TEST_EMAIL="hello@globalworkflow.xyz" 
SESSION_ID="cs_test_aya_manual_force_REAL_PROD_3"

# JSON Payload simulant un événement Stripe Checkout Success (AYA SUB - Force Send)
# Using a specific session ID to trigger fallback logic (no existing analysis in DB for this ID)
# We use a unique session ID to avoid "duplicate event" handling if implemented (though current implementation handles idempotency poorly or not at all for webhooks)
JSON_PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_webhook_aya_force_prod_3",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "$SESSION_ID",
      "object": "checkout.session",
      "amount_total": 1900,
      "currency": "chf",
      "payment_status": "paid",
      "mode": "subscription",
      "metadata": {},
      "customer_details": {
        "email": "$TEST_EMAIL"
      },
      "client_reference_id": "eyJ1IjoiaHR0cHM6Ly9nbG9iYWx3b3JrZmxvdy54eXoiLCJlIjoiaGVsbG9AZ2xvYmFsd29ya2Zsb3cueHl6In0="
    }
  }
}
EOF
)

echo "🚀 Force Sending AYA Email to $TEST_EMAIL via $WEBHOOK_URL..."
curl -v -X POST "$WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD"
