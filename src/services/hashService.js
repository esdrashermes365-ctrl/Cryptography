import { apiFetch } from '../api';

export const HASH_ALGORITHMS = ['Argon2id', 'Bcrypt', 'SHA-256', 'SHA-512'];

export const createHash = ({ payload, algorithm }) =>
  apiFetch('/api/hash/create', { method: 'POST', body: { payload, algorithm } });

export const verifyHash = ({ payload, hash, algorithm }) =>
  apiFetch('/api/hash/verify', { method: 'POST', body: { payload, hash, algorithm } });
