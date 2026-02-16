#!/bin/bash

# Configuration
WEBHOOK_URL="https://ai-visionary.com/api/webhooks/checkout-success"
TEST_EMAIL="hello@globalworkflow.xyz" # The user's email
SESSION_ID="cs_test_aya_manual_force_1"

# JSON Payload simulant un événement Stripe Checkout Success (AYA SUB - Force Send)
JSON_PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_webhook_aya_force",
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
