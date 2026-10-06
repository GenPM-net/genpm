import { Button, Heading, Text } from '@react-email/components';
import { createElement as h } from 'react';
import { button, Layout, muted, text } from './layout.ts';

export type MagicLinkProps = { url: string; expiresInMinutes: number };

export const magicLink = {
  subject: () => 'Your sign-in link',
  render: (p: MagicLinkProps) =>
    h(
      Layout,
      { preview: 'Sign in with one click' },
      h(Heading, { as: 'h1' }, 'Sign in'),
      h(Text, { style: text }, 'Click the button to sign in. The link works once.'),
      h(Button, { href: p.url, style: button }, 'Sign in'),
      h(Text, { style: muted }, `Expires in ${p.expiresInMinutes} minutes. If you did not ask for it, ignore this email.`),
    ),
};
