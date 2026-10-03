// curl -fsSL https://genpm.net/install.sh | sh  (ADR-025)
import type { APIRoute } from 'astro';
import { INSTALLERS, installerResponse } from '../lib/installers.js';

export const GET: APIRoute = () => installerResponse(INSTALLERS.sh);
