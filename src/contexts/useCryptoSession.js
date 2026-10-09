import { useContext } from 'react';
import { CryptoSessionContext } from './CryptoSessionContext';

export default function useCryptoSession() {
  const context = useContext(CryptoSessionContext);
  if (!context) {
    throw new Error('useCryptoSession doit être utilisé dans CryptoSessionProvider.');
  }

  return context;
}
