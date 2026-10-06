// Layout común de los correos (React Email sin JSX: funciona aunque el proyecto use otro jsxImportSource).
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import { createElement as h, type ReactNode } from 'react';

export const brand = { name: process.env.APP_NAME ?? 'App', color: '#0B0D11' };

const body = { backgroundColor: '#f6f7f9', fontFamily: 'Helvetica, Arial, sans-serif', padding: '24px 0' };
const card = { backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '520px' };
export const text = { fontSize: '15px', lineHeight: '24px', color: '#0B0D11' };
export const muted = { fontSize: '13px', color: '#6A7180' };
export const button = {
  backgroundColor: brand.color,
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  fontWeight: 600,
  textDecoration: 'none',
};

export function Layout(props: { preview: string; children?: ReactNode }) {
  return h(
    Html,
    { lang: 'en' },
    h(Head),
    h(Preview, null, props.preview),
    h(
      Body,
      { style: body },
      h(
        Container,
        { style: card },
        h(Section, null, props.children),
        h(Hr),
        h(Text, { style: muted }, brand.name),
      ),
    ),
  );
}
