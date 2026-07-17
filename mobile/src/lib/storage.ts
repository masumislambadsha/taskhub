import * as SecureStore from "expo-secure-store";

const KEYS = {
  TOKEN: "auth_token",
  USER: "user_data",
};

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.TOKEN);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.TOKEN, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.TOKEN);
}

export async function getUserData(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.USER);
  } catch {
    return null;
  }
}

export async function setUserData(user: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USER, user);
}

export async function removeUserData(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.USER);
}

export async function clearAll(): Promise<void> {
  await removeToken();
  await removeUserData();
}
