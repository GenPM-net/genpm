// irm https://genpm.net/install.ps1 | iex  (ADR-025)
import type { APIRoute } from 'astro';
import { INSTALLERS, installerResponse } from '../lib/installers.js';

export const GET: APIRoute = () => installerResponse(INSTALLERS.ps1);
