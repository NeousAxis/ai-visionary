"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentHandler() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const hasRun = useRef(false);

    useEffect(() => {
        if (!sessionId || hasRun.current) return;

        hasRun.current = true;

        // 1. Déclenchement Silencieux de la génération
        const triggerSilentGeneration = async () => {
            try {
                // On notifie le backend que le paiement est fait pour qu'il génère et envoie les fichiers
                await fetch('/api/webhooks/checkout-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });

                // 2. Nettoyage discret de l'URL (enlève le session_id vilain)
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                console.log("✅ Paiement traité avec succès (Background)");
            } catch (e) {
                console.error("Erreur background generation:", e);
            }
        };

        triggerSilentGeneration();
    }, [sessionId]);

    return null; // Invisible
}
