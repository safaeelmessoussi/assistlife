/**
 * Where the encryption key rests between app launches: the system keychain
 * on phones, browser storage on the web (the browser offers nothing safer).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'assistlife.encKey';
const web = Platform.OS === 'web';

export const loadEncKey = () => (web ? AsyncStorage.getItem(KEY) : SecureStore.getItemAsync(KEY));
export const saveEncKey = (value: string) => (web ? AsyncStorage.setItem(KEY, value) : SecureStore.setItemAsync(KEY, value));
export const clearEncKey = () => (web ? AsyncStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY));
