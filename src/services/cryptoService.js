import { apiFetch } from '../api';

export const CRYPTO_ALGORITHMS = [
  { value: 'AES-128-GCM', label: 'AES-128-GCM' },
  { value: 'AES-256-GCM', label: 'AES-256-GCM' },
  { value: 'ChaCha20-Poly1305', label: 'ChaCha20-Poly1305' },
  { value: 'AES-256-CBC', label: 'AES-256-CBC (authentifié)' },
  { value: 'RSA-OAEP', label: 'RSA-OAEP (SHA-256)' },
];

export const encodeBase64 = (bytes) => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

export const encryptData = async ({
  payload,
  algorithm = 'AES-256-GCM',
  publicKey = '',
}) => {
  try {
    const result = await apiFetch('/api/crypto/encrypt', {
      method: 'POST',
      body: {
        payload,
        algorithm,
        key: algorithm === 'RSA-OAEP' ? publicKey.trim() || undefined : undefined,
      },
    });

    return {
      key: result.key,
      cipherText: JSON.stringify(
        {
          version: 1,
          algorithm,
          iv: result.iv,
          data: result.data,
          tag: result.tag,
        },
        null,
        2,
      ),
    };
  } catch (error) {
    throw new Error(error.message || 'La requête au serveur a échoué.');
  }
};

export const decodeBase64 = (value) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const decryptData = async ({ cipherText, key, algorithm }) => {
  let envelope;
  try {
    envelope = JSON.parse(cipherText);
  } catch {
    throw new Error('Le format des données chiffrées est invalide.');
  }

  if (
    !envelope ||
    envelope.version !== 1 ||
    typeof envelope.algorithm !== 'string' ||
    typeof envelope.data !== 'string'
  ) {
    throw new Error('Les données chiffrées ne sont pas reconnues.');
  }

  const isLegacyAesGcm =
    envelope.algorithm === 'AES-GCM' && [128, 256].includes(envelope.keySize);
  const requestAlgorithm = isLegacyAesGcm
    ? `AES-${envelope.keySize}-GCM`
    : envelope.algorithm;
  if (requestAlgorithm !== algorithm) {
    throw new Error(
      `L’algorithme sélectionné (${algorithm}) ne correspond pas aux données (${requestAlgorithm}).`,
    );
  }

  let { data, tag } = envelope;

  if (isLegacyAesGcm) {
    try {
      const encryptedBytes = Uint8Array.from(
        atob(envelope.data),
        (character) => character.charCodeAt(0),
      );
      if (encryptedBytes.length < 16) {
        throw new Error('Données incomplètes.');
      }
      data = encodeBase64(encryptedBytes.slice(0, -16));
      tag = encodeBase64(encryptedBytes.slice(-16));
    } catch {
      throw new Error('Les données chiffrées AES-GCM sont invalides.');
    }
  }

  try {
    return await apiFetch('/api/crypto/decrypt', {
      method: 'POST',
      body: { data, algorithm: requestAlgorithm, key, iv: envelope.iv, tag },
    });
  } catch (error) {
    throw new Error(error.message || 'La requête au serveur a échoué.');
  }
};
