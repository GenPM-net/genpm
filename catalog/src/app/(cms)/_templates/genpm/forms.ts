// Formularios definidos en código. Los editores también pueden crearlos en el panel (Formularios).
import { z } from 'zod';
import { defineForm } from '@/lib/forms';

defineForm({
  key: 'contact',
  label: 'Contact',
  schema: z.object({ name: z.string().trim().min(1).max(120), email: z.email(), message: z.string().trim().min(5).max(5000) }),
  emailField: 'email',
  // Texto pendiente de revisar por el titular del sitio: enlaza a su política de privacidad real.
  consent: { required: true, version: '2026-10', text: 'I have read the privacy policy and agree to be contacted about my request.' },
});
