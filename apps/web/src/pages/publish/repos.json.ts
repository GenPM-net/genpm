// Repos públicos del usuario y de sus orgs (asistente de publicación).
import type { APIRoute } from 'astro';
import { relay } from '../../lib/relay.js';

export const GET: APIRoute = (ctx) => relay(ctx, '/v1/me/repos');
