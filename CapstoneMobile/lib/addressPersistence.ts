import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'bh_psgc_address_';

/** Web `requestmanagement.jsx` uses scope `request_management_admission` for the same prefix pattern. */
export function getAddressStorageKey(scope: 'signup' | 'admission' | 'request_management_admission') {
  return `${PREFIX}${scope}`;
}

export type AddressDraftV1 = {
  version: 1;
  province: string;
  city: string;
  barangay: string;
  street: string;
  provinceCode: string;
  provinceKind: string;
  cityCode: string;
  barangayCode: string;
};

export type AddressDraftPayload = Omit<AddressDraftV1, 'version'>;

export async function loadAddressDraft(key: string): Promise<Partial<AddressDraftV1> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as { version?: number } & Partial<AddressDraftV1>;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveAddressDraft(key: string, payload: AddressDraftPayload) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ version: 1, ...payload }));
  } catch {
    /* ignore */
  }
}

export async function clearAddressDraft(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
