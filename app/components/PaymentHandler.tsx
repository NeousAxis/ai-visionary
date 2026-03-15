"use client";

// H9 fix: This component previously called /api/webhooks/checkout-success independently,
// causing a DOUBLE webhook execution alongside PaymentSuccessModal.
// The webhook call is now handled exclusively by PaymentSuccessModal.
// This component is kept as a no-op to avoid breaking any imports.

export default function PaymentHandler() {
    return null;
}
