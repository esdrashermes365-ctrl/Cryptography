import React, { useState } from 'react';
import OperationTabs from '../components/OperationTabs';
import CopyButton from '../components/CopyButton';
import { createHash, HASH_ALGORITHMS, verifyHash } from '../services/hashService';

const HashPage = () => {
  const [algorithm, setAlgorithm] = useState('Argon2id');
  const [verifyAlgorithm, setVerifyAlgorithm] = useState('Argon2id');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [generatedHash, setGeneratedHash] = useState('');
  const [existingHash, setExistingHash] = useState('');
  const [sourceData, setSourceData] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setInputText('');
      setGeneratedHash('');
      setError('');
    }
  };

  const isHashFormValid = inputText.length > 0 || selectedFile !== null;
  const isVerifyFormValid = existingHash.trim() !== '' && sourceData !== '';

  const handleHash = async () => {
    setIsHashing(true);
    setError('');
    setGeneratedHash('');
    try {
      const payload = selectedFile ? await selectedFile.text() : inputText;
      const result = await createHash({ payload, algorithm });
      setGeneratedHash(result.hash);
      setExistingHash(result.hash);
      setVerifyAlgorithm(result.algorithm);
      setSourceData(payload);
      setVerificationResult(null);
    } catch (hashError) {
      setError(hashError.message || 'La création de l’empreinte a échoué.');
    } finally {
      setIsHashing(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setError('');
    setVerificationResult(null);
    try {
      const result = await verifyHash({
        payload: sourceData,
        hash: existingHash.trim(),
        algorithm: verifyAlgorithm,
      });
      setVerificationResult(result);
    } catch (verificationError) {
      setError(verificationError.message || 'La vérification de l’empreinte a échoué.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Barre d'onglets de navigation */}
      <OperationTabs />

      {/* 2. Grille principale supérieure (Profil & Donnée d'entrée) */}
      <div style={styles.contentGrid}>
        
        {/* Colonne de gauche : Profil approuvé */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Profil approuvé</h2>

          {/* Sélection de l'algorithme */}
          <div style={styles.algoGrid}>
            {HASH_ALGORITHMS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAlgorithm(id);
                  setGeneratedHash('');
                  setError('');
                }}
                style={{
                  ...styles.algoButton,
                  ...(algorithm === id ? styles.selectedAlgo : {}),
                }}
              >
                {id}
              </button>
            ))}
          </div>

          <p style={styles.helpText}>
            {algorithm === 'SHA-256' || algorithm === 'SHA-512'
              ? 'Empreintes rapides pour vérifier l’intégrité ; ne les utilisez pas pour stocker des mots de passe.'
              : 'Algorithme adaptatif recommandé pour les mots de passe. Le sel aléatoire est inclus dans l’empreinte.'}
          </p>
        </div>

        {/* Colonne de droite : Donnée d'entrée */}
        <div style={styles.card}>
          <label style={styles.sectionTitle}>Donnée d'entrée</label>
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setSelectedFile(null);
              setGeneratedHash('');
              setError('');
            }}
            placeholder="Texte à traiter"
            style={styles.textarea}
          />

          <div style={styles.dropZone}>
            <span style={styles.dropText}>
              {selectedFile ? selectedFile.name : 'Ou déposer un fichier'}
            </span>
            <label style={styles.browseButton}>
              Parcourir
              <input
                type="file"
                accept="text/*,.txt,.csv,.json,.xml,.md"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {!isHashFormValid && (
            <p style={styles.warningMessage}>
              Saisissez un texte ou déposez un fichier pour continuer.
            </p>
          )}

          <button
            disabled={!isHashFormValid || isHashing}
            onClick={handleHash}
            style={{
              ...styles.submitButton,
              ...(isHashFormValid && !isHashing
                ? styles.activeSubmitButton
                : styles.disabledSubmitButton),
            }}
          >
            {isHashing ? 'Calcul en cours...' : 'Créer l’empreinte'}
          </button>
          {generatedHash && (
            <div style={styles.resultCard}>
              <label style={styles.label}>Empreinte — {algorithm}</label>
              <textarea
                aria-label="Empreinte générée"
                readOnly
                value={generatedHash}
                style={styles.verifyTextarea}
              />
              <CopyButton value={generatedHash} label="l’empreinte" />
            </div>
          )}
        </div>

      </div>

      {/* 3. Section inférieure : Vérification d'empreinte */}
      <div style={{ ...styles.card, marginTop: '1.5rem' }}>
        <h2 style={styles.sectionTitle}>Vérification d'empreinte</h2>

        <div style={styles.verifyGrid}>
          <div>
            <label style={styles.label}>Algorithme de l’empreinte</label>
            <select
              value={verifyAlgorithm}
              onChange={(e) => {
                setVerifyAlgorithm(e.target.value);
                setVerificationResult(null);
              }}
              style={styles.verifySelect}
            >
              {HASH_ALGORITHMS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Empreinte existante</label>
            <textarea
              value={existingHash}
              onChange={(e) => {
                setExistingHash(e.target.value);
                setVerificationResult(null);
                setError('');
              }}
              style={styles.verifyTextarea}
            />
          </div>

          <div>
            <label style={styles.label}>Donnée source</label>
            <textarea
              value={sourceData}
              onChange={(e) => {
                setSourceData(e.target.value);
                setVerificationResult(null);
                setError('');
              }}
              style={styles.verifyTextarea}
            />
          </div>
        </div>

        <button
          disabled={!isVerifyFormValid || isVerifying}
          onClick={handleVerify}
          style={{
            ...styles.submitButton,
            ...(isVerifyFormValid && !isVerifying
              ? styles.activeSubmitButton
              : styles.disabledSubmitButton),
            marginTop: '1rem',
          }}
        >
          {isVerifying ? 'Vérification en cours...' : 'Vérifier l’empreinte'}
        </button>

        {!isVerifyFormValid && (
          <p style={styles.warningMessage}>
            Renseignez l’empreinte à vérifier et la donnée source.
          </p>
        )}
        {verificationResult && (
          <p
            role="status"
            style={{
              ...styles.verificationMessage,
              color: verificationResult.match ? '#34d399' : '#f87171',
            }}
          >
            {verificationResult.message}
          </p>
        )}
      </div>
      {error && <p role="alert" style={styles.errorMessage}>{error}</p>}
    </div>
  );
};

// Feuille de style CSS-in-JS fidèle au design
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
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    paddingBottom: '0.5rem',
  },
  activeTabButton: {
    color: '#ffffff',
    fontWeight: '600',
    borderBottom: '2px solid #3b82f6',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
    marginTop: 0,
  },
  algoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  algoButton: {
    backgroundColor: '#090d16',
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
  rangeGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    color: '#e2e8f0',
    marginBottom: '0.4rem',
  },
  slider: {
    width: '100%',
    accentColor: '#3b82f6',
    cursor: 'pointer',
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
    resize: 'none',
    boxSizing: 'border-box',
  },
  dropZone: {
    border: '1px dashed #1e293b',
    borderRadius: '6px',
    padding: '0.85rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#080d16',
    marginTop: '1rem',
  },
  dropText: {
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  browseButton: {
    backgroundColor: '#090d16',
    border: '1px solid #374151',
    color: '#e5e7eb',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  verifyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginTop: '0.5rem',
  },
  verifyTextarea: {
    width: '100%',
    height: '80px',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box',
  },
  verifySelect: {
    width: '100%',
    height: '80px',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  resultCard: {
    marginTop: '1.25rem',
    padding: '1rem',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
  },
  verificationMessage: {
    fontSize: '0.9rem',
    fontWeight: '600',
    marginTop: '1rem',
  },
  errorMessage: {
    color: '#f87171',
    fontSize: '0.9rem',
    marginTop: '1rem',
  },
  warningMessage: {
    color: '#f59e0b',
    fontSize: '0.8rem',
    marginTop: '0.5rem',
  },
  submitButton: {
    borderRadius: '6px',
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: 'none',
    width: 'fit-content',
    marginTop: '1.25rem',
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

export default HashPage;