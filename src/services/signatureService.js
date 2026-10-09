import { apiFetch } from '../api';

export const SIGNATURE_HASHES = ['SHA-256', 'SHA-512'];
export const SIGNATURE_KEY_SIZES = [2048, 4096];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const signFile = ({ file, hashAlgorithm, keySize, privateKey }) => {
  const form = new FormData();
  form.append('file', file);
  form.append('hash_algorithm', hashAlgorithm);
  form.append('key_size', String(keySize));
  if (privateKey && privateKey.trim()) form.append('private_key', privateKey.trim());
  return apiFetch('/api/signature/sign', { method: 'POST', formData: form });
};

export const verifySignature = ({ file, signature, publicKey, hashAlgorithm, expectedDigest }) => {
  const form = new FormData();
  form.append('file', file);
  form.append('signature', signature.trim());
  form.append('public_key', publicKey.trim());
  form.append('hash_algorithm', hashAlgorithm);
  if (expectedDigest && expectedDigest.trim()) form.append('expected_digest', expectedDigest.trim());
  return apiFetch('/api/signature/verify', { method: 'POST', formData: form });
};
