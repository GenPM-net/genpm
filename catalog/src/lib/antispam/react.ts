// `<AntispamFields />`: campos ocultos para formularios HTML (trampa y hora firmada). Componente de servidor (async).
import { createElement as h, Fragment, type ReactNode } from 'react';
import { formTimingToken, HONEYPOT_FIELD, honeypotProps, TIMING_FIELD } from './checks.js';

export async function AntispamFields(): Promise<ReactNode> {
  return h(Fragment, null, h('input', { ...honeypotProps, key: HONEYPOT_FIELD }), h('input', { type: 'hidden', name: TIMING_FIELD, value: await formTimingToken(), key: TIMING_FIELD }));
}
