import React, { useState } from 'react';
import OperationTabs from '../components/OperationTabs';
import CopyButton from '../components/CopyButton';
import useCryptoSession from '../contexts/useCryptoSession';
import {
  CRYPTO_ALGORITHMS,
  decodeBase64,
  decryptData,
} from '../services/cryptoService';
import { downloadFile } from '../services/fileService';
import {
  extractCiphertextFromImage,
  restoreMaskedRegion,
} from '../services/imageCryptoService';

const DecryptPage = () => {
  const { session, setSession } = useCryptoSession();
  const {
    algorithm = 'AES-256-GCM',
    encryptedData,
    decryptionKey,
    plainText,
  } = session;
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState('');
  const [decryptedFile, setDecryptedFile] = useState(null);

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setError('');
    setDecryptedFile(null);
    setSession((current) => ({ ...current, plainText: '' }));

    try {
      let envelope;
      try {
        envelope = JSON.parse(encryptedData);
      } catch {
        envelope = null;
      }
      if (envelope?.type === 'image-region-v1') {
        const result = await decryptData({
          cipherText: JSON.stringify(envelope.encryptedRegion),
          key: decryptionKey,
          algorithm,
        });
        const image = await restoreMaskedRegion(envelope, result.plainText);
        setDecryptedFile({
          content: image,
          fileName: `${envelope.fileName || 'image'}.restauree.png`,
        });
        return;
      }

      const result = await decryptData({
        cipherText: encryptedData,
        key: decryptionKey,
        algorithm,
      });
      let filePayload;
      try {
        filePayload = JSON.parse(result.plainText);
      } catch {
        filePayload = null;
      }
      if (filePayload?.type === 'file') {
        if (
          typeof filePayload.fileName !== 'string' ||
          typeof filePayload.data !== 'string'
        ) {
          throw new Error('Le fichier déchiffré n’a pas un format valide.');
        }
        setDecryptedFile({
          content: decodeBase64(filePayload.data),
          fileName: filePayload.fileName,
        });
        setSession((current) => ({ ...current, plainText: '' }));
      } else {
        setDecryptedFile(null);
        setSession((current) => ({ ...current, plainText: result.plainText }));
      }
    } catch (decryptionError) {
      setDecryptedFile(null);
      setError(decryptionError.message || 'Le déchiffrement a échoué.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const isFormValid =
    encryptedData.trim() !== '' &&
    decryptionKey.trim() !== '' &&
    CRYPTO_ALGORITHMS.some((supported) => supported.value === algorithm);

  const handleEncryptedDataChange = (value) => {
    let detectedAlgorithm;
    try {
      const parsed = JSON.parse(value);
      const parsedAlgorithm =
        parsed.algorithm === 'AES-GCM' && [128, 256].includes(parsed.keySize)
          ? `AES-${parsed.keySize}-GCM`
          : parsed.algorithm;
      if (CRYPTO_ALGORITHMS.some(({ value: supported }) => supported === parsedAlgorithm)) {
        detectedAlgorithm = parsedAlgorithm;
      }
    } catch {
      detectedAlgorithm = undefined;
    }

    setSession((current) => ({
      ...current,
      encryptedData: value,
      plainText: '',
      ...(detectedAlgorithm ? { algorithm: detectedAlgorithm } : {}),
    }));
    setDecryptedFile(null);
  };

  const handleEncryptedFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const contents = file.type.startsWith('image/')
        ? await extractCiphertextFromImage(file)
        : await file.text();
      handleEncryptedDataChange(contents);
    } catch (fileError) {
      setError(fileError.message || 'Impossible de lire le fichier chiffré.');
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Barre d'onglets de navigation cryptographique */}
      <OperationTabs />

      {/* 2. Grille principale à 2 colonnes */}
      <div style={styles.contentGrid}>
        
        {/* Colonne de gauche : Profil approuvé */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Profil approuvé</h2>
          <p style={styles.helpText}>
            Sélectionnez le même algorithme que celui indiqué dans les données chiffrées.
          </p>
          <div style={styles.inputGroup}>
            <label style={styles.sectionTitle}>Algorithme de déchiffrement</label>
            <select
              value={algorithm}
              onChange={(e) => {
                setSession((current) => ({
                  ...current,
                  algorithm: e.target.value,
                  plainText: '',
                }));
                setDecryptedFile(null);
              }}
              style={styles.textInput}
            >
              {CRYPTO_ALGORITHMS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Colonne de droite : Donnée chiffrée & Clé de déchiffrement */}
        <div style={styles.card}>
          {/* Champ Donnée chiffrée */}
          <label style={styles.sectionTitle}>Donnée chiffrée</label>
          <textarea
            value={encryptedData}
            onChange={(e) => handleEncryptedDataChange(e.target.value)}
            style={styles.textarea}
          />
          <label style={styles.fileInputLabel}>
            Ou sélectionner un fichier chiffré
            <input
              type="file"
              accept=".json,application/json,image/*"
              onChange={handleEncryptedFileChange}
              style={styles.fileInput}
            />
          </label>
          {encryptedData.trim() === '' && (
            <p style={styles.warningMessage}>Collez la donnée chiffrée.</p>
          )}

          {/* Champ Clé de déchiffrement */}
          <div style={{ marginTop: '1rem' }}>
            <label style={styles.sectionTitle}>Clé de déchiffrement</label>
            <input
              type="text"
              value={decryptionKey}
              onChange={(e) => {
                setSession((current) => ({
                  ...current,
                  decryptionKey: e.target.value,
                  plainText: '',
                }));
                setDecryptedFile(null);
              }}
              style={styles.textInput}
            />
            {decryptionKey.trim() === '' && (
              <p style={styles.warningMessage}>Collez la clé reçue lors du chiffrement.</p>
            )}
          </div>

          {/* Bouton de confirmation */}
          <button
            disabled={!isFormValid || isDecrypting}
            onClick={handleDecrypt}
            style={{
              ...styles.submitButton,
              ...(isFormValid && !isDecrypting
                ? styles.activeSubmitButton
                : styles.disabledSubmitButton),
            }}
          >
            {isDecrypting ? 'Déchiffrement en cours...' : 'Déchiffrer les données'}
          </button>
          {error && <p role="alert" style={styles.errorMessage}>{error}</p>}
          {plainText && (
            <div style={styles.resultCard}>
              <label className="block text-sm text-slate-400 mb-2">Texte déchiffré</label>
              <textarea
                aria-label="Texte déchiffré"
                readOnly
                value={plainText}
                style={styles.textarea}
              />
              <CopyButton value={plainText} label="le texte déchiffré" />
              <button
                type="button"
                onClick={() =>
                  downloadFile(plainText, 'donnees-dechiffrees.txt', 'text/plain')
                }
                style={{ ...styles.submitButton, ...styles.activeSubmitButton }}
              >
                Télécharger le fichier déchiffré
              </button>
            </div>
          )}
          {decryptedFile && (
            <div style={styles.resultCard}>
              <p style={styles.helpText}>
                Fichier déchiffré : {decryptedFile.fileName}
              </p>
              <button
                type="button"
                onClick={() =>
                  downloadFile(decryptedFile.content, decryptedFile.fileName)
                }
                style={{ ...styles.submitButton, ...styles.activeSubmitButton }}
              >
                Télécharger le fichier déchiffré
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// Styles CSS-in-JS fidèles au design sombre
const styles = {
  container: {
    backgroundColor: '#070a0f',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '1.5rem 2rem',
  },
  tabBar: {
    display: 'flex',
    gap: '1.5rem',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '0.5rem',
    marginBottom: '2rem',
  },
  tabButton: {
    background: 'none',
    border: '0',
    borderBottom: '2px solid transparent',
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    paddingBottom: '0.5rem',
  },
  activeTabButton: {
    color: '#ffffff',
    fontWeight: '600',
    borderBottomColor: '#3b82f6',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#0d131f',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '0.75rem',
  },
  algoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  algoButton: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    color: '#9ca3af',
    borderRadius: '6px',
    padding: '0.65rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  selectedAlgo: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: '1px solid #3b82f6',
    fontWeight: '600',
  },
  helpText: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: '1.4',
    marginBottom: '0.5rem',
  },
  subHelpText: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginBottom: '1.25rem',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginBottom: '0.4rem',
  },
  selectInput: {
    width: '100%',
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.85rem',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    height: '110px',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.65rem 0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box',
  },
  warningMessage: {
    color: '#f59e0b',
    fontSize: '0.8rem',
    marginTop: '0.4rem',
    marginBottom: '0.5rem',
  },
  submitButton: {
    borderRadius: '6px',
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: 'none',
    width: 'fit-content',
    marginTop: '1.5rem',
  },
  activeSubmitButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    cursor: 'pointer',
  },
  disabledSubmitButton: {
    backgroundColor: '#1d2d44',
    color: '#475569',
    cursor: 'not-allowed',
  },
  errorMessage: {
    color: '#f87171',
    fontSize: '0.9rem',
    marginTop: '1rem',
  },
  resultCard: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
  },
  fileInputLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    color: '#94a3b8',
    fontSize: '0.8rem',
    marginTop: '0.75rem',
  },
  fileInput: {
    color: '#e2e8f0',
    fontSize: '0.8rem',
  },
};

export default DecryptPage;