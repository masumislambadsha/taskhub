import * as SecureStore from "expo-secure-store";

const KEYS = {
  TOKEN: "auth_token",
  USER: "user_data",
};

async function storeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return null;
  }
}

async function storeSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  }
}

async function storeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  }
}

export async function getToken(): Promise<string | null> {
  return storeGet(KEYS.TOKEN);
}

export async function setToken(token: string): Promise<void> {
  await storeSet(KEYS.TOKEN, token);
}

export async function removeToken(): Promise<void> {
  await storeDelete(KEYS.TOKEN);
}

export async function getUserData(): Promise<string | null> {
  return storeGet(KEYS.USER);
}

export async function setUserData(user: string): Promise<void> {
  await storeSet(KEYS.USER, user);
}

export async function removeUserData(): Promise<void> {
  await storeDelete(KEYS.USER);
}

export async function clearAll(): Promise<void> {
  await removeToken();
  await removeUserData();
}

export const clearAuth = clearAll;
