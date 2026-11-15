/**
 * Gaps in the phone runtime that the browser does not have. Imported before
 * anything else.
 */
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  // The account client needs a complete URL implementation.
  require('react-native-url-polyfill/auto');

  // Secure random numbers for encryption come from the operating system.
  const target = globalThis as { crypto?: Partial<Crypto> };
  if (typeof target.crypto?.getRandomValues !== 'function') {
    target.crypto = { ...target.crypto, getRandomValues: ExpoCrypto.getRandomValues as Crypto['getRandomValues'] };
  }
}
