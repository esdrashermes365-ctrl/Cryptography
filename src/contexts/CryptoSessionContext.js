import { createContext } from 'react';

export const CryptoSessionContext = createContext(null);

export const initialCryptoSession = {
  algorithm: 'AES-256-GCM',
  rsaPublicKey: '',
  inputText: '',
  selectedFile: null,
  cipherText: '',
  generatedKey: '',
  encryptedData: '',
  decryptionKey: '',
  plainText: '',
};
