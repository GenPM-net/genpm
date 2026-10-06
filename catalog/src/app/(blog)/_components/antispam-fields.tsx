// Campos anti-spam de @core/antispam para formularios HTML (honeypot y hora firmada).
import { formTimingToken, honeypotProps, TIMING_FIELD } from '@/lib/antispam';

export async function AntispamFields() {
  return (
    <>
      <input {...honeypotProps} />
      <input type="hidden" name={TIMING_FIELD} value={await formTimingToken()} />
    </>
  );
}
