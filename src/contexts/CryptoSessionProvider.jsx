import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  CryptoSessionContext,
  initialCryptoSession,
} from './CryptoSessionContext';

export default function CryptoSessionProvider({ children }) {
  const { user } = useAuth();
  const [session, setSession] = useState(initialCryptoSession);
  const [owner, setOwner] = useState(user);

  // Les clés et textes en mémoire sont effacés dès que la session se termine
  // ou qu'un autre compte se connecte.
  if (owner !== user) {
    setOwner(user);
    setSession(initialCryptoSession);
  }

  const value = useMemo(() => ({ session, setSession }), [session]);

  return (
    <CryptoSessionContext.Provider value={value}>
      {children}
    </CryptoSessionContext.Provider>
  );
}
