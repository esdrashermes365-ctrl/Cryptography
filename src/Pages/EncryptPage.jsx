import React, { useState } from 'react';
import OperationTabs from '../components/OperationTabs';
import CopyButton from '../components/CopyButton';
import ImageCryptoPanel from '../components/ImageCryptoPanel';
import useCryptoSession from '../contexts/useCryptoSession';
import {
  CRYPTO_ALGORITHMS,
  encodeBase64,
  encryptData,
} from '../services/cryptoService';
import { downloadFile } from '../services/fileService';

const EncryptPage = () => {
  const { session, setSession } = useCryptoSession();
  const {
    algorithm = 'AES-256-GCM',
    rsaPublicKey = '',
    inputText,
    selectedFile,
    cipherText,
    generatedKey,
  } = session;
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState('');
  const [outputFileName, setOutputFileName] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setOutputFileName('');
      setSession((current) => ({
        ...current,
        selectedFile: e.target.files[0],
        inputText: '',
        cipherText: '',
        generatedKey: '',
        encryptedData: '',
        decryptionKey: '',
        plainText: '',
      }));
    }
  };

  const handleEncrypt = async () => {
    setIsEncrypting(true);
    setError('');
    setSession((current) => ({
      ...current,
      cipherText: '',
      generatedKey: '',
    }));

    try {
      const payload = selectedFile
        ? JSON.stringify({
            type: 'file',
            fileName: selectedFile.name,
            data: encodeBase64(new Uint8Array(await selectedFile.arrayBuffer())),
          })
        : inputText;
      const result = await encryptData({
        payload,
        algorithm,
        publicKey: rsaPublicKey,
      });
      const formattedCipherText = result.cipherText;
      setOutputFileName(
        selectedFile ? `${selectedFile.name}.encrypted.json` : 'donnees-chiffrees.json',
      );
      setSession((current) => ({
        ...current,
        cipherText: formattedCipherText,
        generatedKey: result.key || '',
        encryptedData: formattedCipherText,
        decryptionKey: result.key || '',
        plainText: '',
      }));
    } catch (encryptionError) {
      setError(encryptionError.message || 'Le chiffrement a échoué.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleImageResult = ({ cipherText: resultText, key, fileName }) => {
    setOutputFileName(fileName);
    setError('');
    setSession((current) => ({
      ...current,
      cipherText: resultText,
      generatedKey: key || '',
      encryptedData: resultText,
      decryptionKey: key || '',
      plainText: '',
    }));
  };

  const clearImageResult = () => {
    setSession((current) => ({
      ...current,
      cipherText: '',
      generatedKey: '',
      encryptedData: '',
      decryptionKey: '',
      plainText: '',
    }));
  };

  const isFormValid = inputText.trim() !== '' || selectedFile !== null;
  const isImageSelected = ['image/png', 'image/jpeg', 'image/webp'].includes(
    selectedFile?.type,
  );
  const isUnsupportedImage = selectedFile?.type?.startsWith('image/') && !isImageSelected;

  return (
    <div style={styles.container}>
      {/* 1. Barre d'onglets de navigation cryptographique */}
      <OperationTabs />

      {/* 2. Grille principale à 2 colonnes */}
      <div style={styles.contentGrid}>
        
        {/* Colonne de gauche : Profil et Paramètres */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Profil approuvé</h2>

          {/* Sélection d'algorithme */}
          <p style={styles.algorithmBadge}>
            {algorithm}
          </p>

          {/* Textes d'aide */}
          <p style={styles.helpText}>
            Le chiffrement est effectué par le backend avec un nonce aléatoire et une clé propre à chaque opération.
          </p>
          <p style={styles.subHelpText}>
            Conservez la clé affichée après le chiffrement : elle sera nécessaire pour déchiffrer.
          </p>

          {/* Sélection de l'algorithme */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Algorithme de chiffrement</label>
            <select
              value={algorithm}
              onChange={(e) => {
                setOutputFileName('');
                setSession((current) => ({
                  ...current,
                  algorithm: e.target.value,
                  cipherText: '',
                  generatedKey: '',
                  encryptedData: '',
                  decryptionKey: '',
                  plainText: '',
                }));
              }}
              style={styles.selectInput}
            >
              {CRYPTO_ALGORITHMS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {algorithm === 'RSA-OAEP' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Clé publique RSA (facultative)</label>
              <textarea
                value={rsaPublicKey}
                onChange={(e) => {
                  setOutputFileName('');
                  setSession((current) => ({
                    ...current,
                    rsaPublicKey: e.target.value,
                    cipherText: '',
                    generatedKey: '',
                    encryptedData: '',
                    decryptionKey: '',
                    plainText: '',
                  }));
                }}
                placeholder="-----BEGIN PUBLIC KEY-----"
                style={styles.textarea}
              />
              <p style={styles.subHelpText}>
                Sans clé publique, une paire temporaire est créée et la clé privée est renvoyée pour le déchiffrement.
              </p>
            </div>
          )}

        </div>

        {/* Colonne de droite : Saisie des Données d'entrée */}
        <div style={styles.card}>
          <label style={styles.sectionTitle}>Donnée d'entrée</label>

          {/* Zone de texte */}
          <textarea
            value={inputText}
            onChange={(e) => {
              setOutputFileName('');
              setSession((current) => ({
                ...current,
                inputText: e.target.value,
                selectedFile: null,
                cipherText: '',
                generatedKey: '',
                encryptedData: '',
                decryptionKey: '',
                plainText: '',
              }));
            }}
            placeholder="Texte à traiter"
            style={styles.textarea}
          />

          {/* Zone Dépôt de Fichier */}
          <div style={styles.dropZone}>
            <span style={styles.dropText}>
              {selectedFile ? selectedFile.name : 'Ou déposer un fichier'}
            </span>
            <label style={styles.browseButton}>
              Parcourir
              <input
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {isImageSelected && (
            <ImageCryptoPanel
              key={`${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`}
              file={selectedFile}
              algorithm={algorithm}
              publicKey={rsaPublicKey}
              hasResult={Boolean(cipherText)}
              onStart={clearImageResult}
              onResult={handleImageResult}
              onError={setError}
            />
          )}
          {isUnsupportedImage && (
            <p style={styles.warningMessage}>
              Les outils d’image acceptent PNG, JPEG et WebP. Ce fichier sera chiffré entièrement.
            </p>
          )}

          {/* Message de consigne */}
          {!isFormValid && (
            <p style={styles.warningMessage}>
              Saisissez un texte ou déposez un fichier pour continuer.
            </p>
          )}

          {/* Bouton de confirmation */}
          {!isImageSelected && (
            <button
              disabled={!isFormValid || isEncrypting}
              onClick={handleEncrypt}
              style={{
                ...styles.submitButton,
                ...(isFormValid && !isEncrypting
                  ? styles.activeSubmitButton
                  : styles.disabledSubmitButton),
              }}
            >
              {isEncrypting ? 'Chiffrement en cours...' : 'Chiffrer les données'}
            </button>
          )}
        </div>

      </div>

      {error && <p role="alert" style={styles.errorMessage}>{error}</p>}

      {cipherText && (
        <div style={styles.resultCard}>
          <h2 style={styles.sectionTitle}>Donnée chiffrée</h2>
          <p style={styles.helpText}>
            Copiez cette valeur et collez-la dans la page de déchiffrement.
          </p>
          <textarea
            aria-label="Donnée chiffrée"
            readOnly
            value={cipherText}
            style={styles.resultTextarea}
          />
          <CopyButton value={cipherText} label="le texte chiffré" />
          <button
            type="button"
            onClick={() =>
              downloadFile(
                cipherText,
                outputFileName ||
                  (selectedFile
                    ? `${selectedFile.name}.encrypted.json`
                    : 'donnees-chiffrees.json'),
                'application/json',
              )
            }
            style={{ ...styles.submitButton, ...styles.activeSubmitButton }}
          >
            Télécharger le fichier chiffré
          </button>
          {generatedKey ? (
            <>
              <label style={styles.label}>Clé de déchiffrement — à conserver séparément</label>
              <textarea
                aria-label="Clé de déchiffrement générée"
                readOnly
                value={generatedKey}
                style={styles.resultKey}
              />
              <CopyButton value={generatedKey} label="la clé" />
            </>
          ) : (
            <p style={styles.helpText}>
              La clé publique n’est pas une clé de déchiffrement. Saisissez la clé privée correspondante sur la page de déchiffrement.
            </p>
          )}
          <p style={styles.warningMessage}>
            La clé n’est pas enregistrée. Si vous la perdez, les données ne pourront pas être déchiffrées.
          </p>
        </div>
      )}
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
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '1rem',
    marginTtop: 0,
  },
  algorithmBadge: {
    display: 'inline-block',
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    color: '#e2e8f0',
    borderRadius: '6px',
    padding: '0.65rem',
    fontSize: '0.85rem',
    margin: '0 0 1.25rem',
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
    height: '140px',
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
    marginBottom: '1rem',
  },
  dropZone: {
    border: '1px dashed #1e293b',
    borderRadius: '6px',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#080d16',
    marginBottom: '1rem',
  },
  dropText: {
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  browseButton: {
    backgroundColor: '#111827',
    border: '1px solid #374151',
    color: '#e5e7eb',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  warningMessage: {
    color: '#f59e0b',
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
  errorMessage: {
    color: '#f87171',
    fontSize: '0.9rem',
    marginTop: '1rem',
  },
  resultCard: {
    backgroundColor: '#0d131f',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '1.5rem',
    marginTop: '1.5rem',
  },
  resultTextarea: {
    width: '100%',
    minHeight: '140px',
    boxSizing: 'border-box',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#a7f3d0',
    padding: '0.75rem',
    fontFamily: 'monospace',
    resize: 'vertical',
  },
  resultKey: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontFamily: 'monospace',
    overflowWrap: 'anywhere',
  },
  submitButton: {
    borderRadius: '6px',
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: 'none',
    width: 'fit-content',
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
};

export default EncryptPage;