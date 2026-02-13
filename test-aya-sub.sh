
#!/bin/bash

# Configuration
WEBHOOK_URL="http://localhost:3000/api/webhooks/checkout-success"
WEBHOOK_URL_PROD="https://ai-visionary.com/api/webhooks/checkout-success"
TEST_EMAIL="hello@globalworkflow.xyz"
SESSION_ID="cs_test_aya_sub_123"

# JSON Payload simulant un événement Stripe Checkout Success
# ATTENTION: On utilise 'force_email' pour bypasser Stripe API en dev local
JSON_PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_webhook_aya_sub",
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
      "metadata": {
        "pack_type": "AYA_SUB",
        "customer_email": "$TEST_EMAIL", 
        "analyzed_url": "https://globalworkflow.xyz"
      },
      "customer_details": {
        "email": "$TEST_EMAIL"
      }
    }
  },
  "force_email": "$TEST_EMAIL" 
}
EOF
)

echo "🚀 Sending Test Webhook (AYA_SUB) to $WEBHOOK_URL..."
echo "Payload: $JSON_PAYLOAD"

curl -X POST "$WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD"

echo ""
echo "✅ Request Sent."
