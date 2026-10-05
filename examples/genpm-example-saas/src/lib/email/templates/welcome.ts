import { Button, Heading, Text } from '@react-email/components';
import { createElement as h } from 'react';
import { button, Layout, text } from './layout.js';

export type WelcomeProps = { name: string | null; appUrl: string };

export const welcome = {
  subject: (p: WelcomeProps) => `Welcome${p.name ? `, ${p.name}` : ''}!`,
  render: (p: WelcomeProps) =>
    h(
      Layout,
      { preview: 'Your account is ready' },
      h(Heading, { as: 'h1' }, `Welcome${p.name ? `, ${p.name}` : ''}!`),
      h(Text, { style: text }, 'Your account is ready. Jump back in whenever you like.'),
      h(Button, { href: p.appUrl, style: button }, 'Open the app'),
    ),
};
