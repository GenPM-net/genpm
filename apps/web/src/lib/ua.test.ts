import { describe, expect, it } from 'vitest';
import { campaign, refHost, routeOf, uaClass } from './ua.js';

describe('uaClass', () => {
  it('marks crawlers, AI fetchers, scripts and empty user-agents as bots', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Claude-User/1.0',
      'curl/8.7.1',
      'node-fetch',
      '',
      null,
    ])
      expect(uaClass(ua)).toBe('bot');
  });
  it('keeps real browsers as human', () => {
    expect(
      uaClass(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('human');
    expect(
      uaClass(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('human');
  });
});

describe('visit helpers', () => {
  it('keeps only the external referrer host', () => {
    expect(refHost('https://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
    expect(refHost('https://www.google.com/')).toBe('google.com');
    expect(refHost('https://genpm.net/search?q=x')).toBe('');
    expect(refHost('https://staging.genpm.net/')).toBe('');
    expect(refHost('not a url')).toBe('');
    expect(refHost(null)).toBe('');
  });
  it('normalizes the campaign', () => {
    expect(campaign(new URL('https://genpm.net/?utm_source=Show%20HN'))).toBe('showhn');
    expect(campaign(new URL('https://genpm.net/?ref=x.com'))).toBe('x.com');
    expect(campaign(new URL('https://genpm.net/'))).toBe('');
  });
  it('groups package and scope routes', () => {
    expect(routeOf('/p/@core/auth')).toBe('/p/*');
    expect(routeOf('/@core')).toBe('/@*');
    expect(routeOf('/docs/install')).toBe('/docs/install');
    expect(routeOf('')).toBe('/');
  });
});
