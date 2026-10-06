'use client';
// `view_item` en el navegador (solo se pinta dentro de <ConsentGate>).
import { useEffect } from 'react';
import type { Money } from '@/lib/money';
import { newEventId, track } from '@/lib/pixels/client';

export function TrackView({ item }: { item: { id: string; name: string; price: Money } }) {
  useEffect(() => {
    track({ type: 'view_item', eventId: newEventId(), value: item.price, items: [{ id: item.id, name: item.name, price: item.price, quantity: 1 }] });
  }, [item.id, item.name, item.price]);
  return null;
}
