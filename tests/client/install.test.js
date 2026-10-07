// Install guide: which platform's steps the "Install app" modal shows first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platform } from '../../client/ui/install.js';

test('platform picks the install guide from the user agent', () => {
  const ua = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
    winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  };
  assert.equal(platform(ua.iphone, true), 'ios');
  assert.equal(platform(ua.ipadOS, true), 'ios'); // iPadOS Safari claims to be a Mac, but has touch
  assert.equal(platform(ua.ipadOS, false), 'mac-safari');
  assert.equal(platform(ua.android, true), 'android');
  assert.equal(platform(ua.androidFirefox, true), 'android');
  assert.equal(platform(ua.winChrome, false), 'desktop');
  assert.equal(platform(ua.macChrome, false), 'desktop');
  assert.equal(platform(ua.winFirefox, false), 'firefox-desktop');
});
