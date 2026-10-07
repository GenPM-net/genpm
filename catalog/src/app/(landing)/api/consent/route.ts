// Guarda la elección del banner de cookies (@core/consent) y borra las cookies de las categorías rechazadas.
import { consentRoute } from '@/lib/consent/adapters/next';

export const dynamic = 'force-dynamic';
export const { GET, POST } = consentRoute({ cookiesByCategory: { analytics: ['_ga', '_gid'], marketing: ['_fbp', '_fbc', '_ttp', 'ttclid'] } });
