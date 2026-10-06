'use client';
// Evento `lead` en el navegador (una vez), con el mismo eventId que el del servidor. Va dentro de <ConsentGate>.
import { useEffect } from 'react';
import { track } from '@/lib/pixels/client';

export function TrackLead({ eventId, formKey }: { eventId: string; formKey?: string }) {
  useEffect(() => {
    const key = `tracked:${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    track({ type: 'lead', eventId, ...(formKey && { formKey }) });
  }, [eventId, formKey]);
  return null;
}
