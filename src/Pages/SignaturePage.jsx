import React, { useState } from 'react';
import OperationTabs from '../components/OperationTabs';
import CopyButton from '../components/CopyButton';
import {
  MAX_FILE_BYTES,
  SIGNATURE_HASHES,
  SIGNATURE_KEY_SIZES,
  signFile,
  verifySignature,
} from '../services/signatureService';

const GENERATE = 'generate';
const IMPORT = 'import';

const tooBig = (file) =>
  file && file.size > MAX_FILE_BYTES
    ? `Fichier trop volumineux (maximum ${MAX_FILE_BYTES / (1024 * 1024)} Mo).`
    : '';

const SignaturePage = () => {
  // Signature
  const [keySize, setKeySize] = useState(2048);
  const [hashAlgo, setHashAlgo] = useState('SHA-256');
  const [fileToSign, setFileToSign] = useState(null);
  const [keyPairOption, setKeyPairOption] = useState(GENERATE);
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [signResult, setSignResult] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState('');

  // Vérification
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyHashAlgo, setVerifyHashAlgo] = useState('SHA-256');
  const [signatureText, setSignatureText] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [expectedDigest, setExpectedDigest] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const handleFileToSignChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileToSign(file);
    setSignResult(null);
    setSignError(tooBig(file));
  };

  const handleVerifyFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyFile(file);
    setVerifyResult(null);
    setVerifyError(tooBig(file));
  };

  const isSignFormValid =
    fileToSign !== null &&
    !tooBig(fileToSign) &&
    (keyPairOption === GENERATE || privateKeyPem.trim() !== '');
  const isVerifyFormValid =
    verifyFile !== null &&
    !tooBig(verifyFile) &&
    signatureText.trim() !== '' &&
    publicKeyPem.trim() !== '';

  const handleSign = async () => {
    setIsSigning(true);
    setSignError('');
    setSignResult(null);
    try {
      const result = await signFile({
        file: fileToSign,
        hashAlgorithm: hashAlgo,
        keySize,
        privateKey: keyPairOption === IMPORT ? privateKeyPem : '',
      });
      setSignResult(result);
      // Le formulaire de vérification est prérempli avec ce qui vient d'être signé.
      setVerifyFile(fileToSign);
      setVerifyHashAlgo(result.hashAlgorithm);
      setSignatureText(result.signature);
      setPublicKeyPem(result.publicKeyPem);
      setVerifyResult(null);
      setVerifyError('');
    } catch (error) {
      setSignError(error.message || 'La signature a échoué.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const result = await verifySignature({
        file: verifyFile,
        signature: signatureText,
        publicKey: publicKeyPem,
        hashAlgorithm: verifyHashAlgo,
        expectedDigest,
      });
      setVerifyResult(result);
    } catch (error) {
      setVerifyError(error.message || 'La vérification a échoué.');
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadPrivateKey = () => {
    const blob = new Blob([signResult.privateKeyPem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cle-privee-rsa.pem';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <OperationTabs />

      <div style={styles.contentGrid}>
        {/* Profil approuvé */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Profil approuvé</h2>

          <div style={styles.algoButtonSelected}>RSA-PSS ({hashAlgo})</div>

          <p style={styles.helpText}>
            Signature d’un fichier avec une clé privée RSA. La clé publique sert à vérifier
            l’intégrité du fichier et son origine.
          </p>
          <p style={styles.subHelpText}>
            Mode avancé désactivé. Seuls les réglages du profil sont acceptés.
          </p>

          <div style={styles.inputGroup}>
            <label htmlFor="sig-key-size" style={styles.label}>Taille de clé RSA</label>
            <select
              id="sig-key-size"
              value={keySize}
              onChange={(e) => setKeySize(Number(e.target.value))}
              disabled={keyPairOption === IMPORT}
              style={styles.selectInput}
            >
              {SIGNATURE_KEY_SIZES.map((size) => (
                <option key={size} value={size}>{size} bits</option>
              ))}
            </select>
            {keyPairOption === IMPORT && (
              <p style={styles.subHelpText}>La taille est celle de la clé importée.</p>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="sig-hash" style={styles.label}>Empreinte</label>
            <select
              id="sig-hash"
              value={hashAlgo}
              onChange={(e) => {
                setHashAlgo(e.target.value);
                setSignResult(null);
              }}
              style={styles.selectInput}
            >
              {SIGNATURE_HASHES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fichier à signer */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Fichier à signer</h2>

          <div style={styles.dropZone}>
            <span style={styles.dropText}>
              {fileToSign ? fileToSign.name : 'Déposer un fichier'}
            </span>
            <label style={styles.browseButton}>
              Parcourir
              <input type="file" onChange={handleFileToSignChange} style={{ display: 'none' }} />
            </label>
          </div>

          {!fileToSign && <p style={styles.warningMessage}>Déposez le fichier à signer.</p>}

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="sig-keypair" style={styles.label}>Paire de clés RSA</label>
            <select
              id="sig-keypair"
              value={keyPairOption}
              onChange={(e) => {
                setKeyPairOption(e.target.value);
                setSignResult(null);
              }}
              style={styles.selectInput}
            >
              <option value={GENERATE}>Générer une paire pour cette opération</option>
              <option value={IMPORT}>Importer une clé privée</option>
            </select>
          </div>

          {keyPairOption === IMPORT && (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="sig-private" style={styles.label}>
                Clé privée (PEM, PKCS#8, sans mot de passe)
              </label>
              <textarea
                id="sig-private"
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="-----BEGIN PRIVATE KEY-----"
                style={styles.pemTextarea}
              />
              <p style={styles.subHelpText}>
                La clé sert le temps de la requête et n’est pas conservée par le serveur.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!isSignFormValid || isSigning}
            onClick={handleSign}
            style={{
              ...styles.submitButton,
              ...(isSignFormValid && !isSigning
                ? styles.activeSubmitButton
                : styles.disabledSubmitButton),
            }}
          >
            {isSigning ? 'Signature en cours...' : 'Signer le fichier'}
          </button>

          {signError && <p role="alert" style={styles.errorMessage}>{signError}</p>}
        </div>
      </div>

      {/* Résultat de la signature */}
      {signResult && (
        <div style={{ ...styles.card, marginTop: '1.5rem' }}>
          <h2 style={styles.sectionTitle}>Signature produite</h2>

          <label style={styles.label}>Signature (base64)</label>
          <textarea
            aria-label="Signature"
            readOnly
            value={signResult.signature}
            style={styles.resultTextarea}
          />
          <CopyButton value={signResult.signature} label="la signature" />

          <label style={{ ...styles.label, marginTop: '1rem' }}>Clé publique (PEM)</label>
          <textarea
            aria-label="Clé publique"
            readOnly
            value={signResult.publicKeyPem}
            style={styles.resultTextarea}
          />
          <CopyButton value={signResult.publicKeyPem} label="la clé publique" />

          <p style={styles.monoLine}>
            Empreinte du fichier ({signResult.hashAlgorithm}) : {signResult.fileDigest}
          </p>
          <p style={styles.monoLine}>
            Empreinte de la clé publique (SHA-256) : {signResult.publicKeyFingerprint}
          </p>

          {signResult.privateKeyPem && (
            <div style={styles.privateKeyBox}>
              <label style={styles.label}>Clé privée (PEM)</label>
              <p style={styles.warningMessage}>
                Affichée une seule fois. Le serveur ne la conserve pas : enregistrez-la maintenant.
              </p>
              <textarea
                aria-label="Clé privée"
                readOnly
                value={signResult.privateKeyPem}
                style={styles.resultTextarea}
              />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <CopyButton value={signResult.privateKeyPem} label="la clé privée" />
                <button type="button" onClick={downloadPrivateKey} style={styles.secondaryButton}>
                  Télécharger la clé privée
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vérification de signature */}
      <div style={{ ...styles.card, marginTop: '1.5rem' }}>
        <h2 style={styles.sectionTitle}>Vérification de signature</h2>

        <div style={styles.verifyGrid}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={styles.label}>Fichier</label>
              <div style={styles.dropZone}>
                <span style={styles.dropText}>
                  {verifyFile ? verifyFile.name : 'Déposer le fichier'}
                </span>
                <label style={styles.browseButton}>
                  Parcourir
                  <input type="file" onChange={handleVerifyFileChange} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="ver-hash" style={styles.label}>
                Empreinte utilisée à la signature
              </label>
              <select
                id="ver-hash"
                value={verifyHashAlgo}
                onChange={(e) => {
                  setVerifyHashAlgo(e.target.value);
                  setVerifyResult(null);
                }}
                style={styles.selectInput}
              >
                {SIGNATURE_HASHES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ver-signature" style={styles.label}>Signature (base64)</label>
              <input
                id="ver-signature"
                type="text"
                value={signatureText}
                onChange={(e) => {
                  setSignatureText(e.target.value);
                  setVerifyResult(null);
                }}
                style={styles.textInput}
              />
            </div>

            <div>
              <label htmlFor="ver-digest" style={styles.label}>
                Empreinte attendue du fichier (facultatif)
              </label>
              <input
                id="ver-digest"
                type="text"
                value={expectedDigest}
                onChange={(e) => {
                  setExpectedDigest(e.target.value);
                  setVerifyResult(null);
                }}
                placeholder="Pour comparer avec l’empreinte du fichier reçu"
                style={styles.textInput}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ver-public" style={styles.label}>Clé publique (PEM)</label>
            <textarea
              id="ver-public"
              value={publicKeyPem}
              onChange={(e) => {
                setPublicKeyPem(e.target.value);
                setVerifyResult(null);
              }}
              spellCheck={false}
              style={{ ...styles.pemTextarea, height: '260px' }}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!isVerifyFormValid || isVerifying}
          onClick={handleVerify}
          style={{
            ...styles.submitButton,
            ...(isVerifyFormValid && !isVerifying
              ? styles.activeSubmitButton
              : styles.disabledSubmitButton),
            marginTop: '1.25rem',
          }}
        >
          {isVerifying ? 'Vérification en cours...' : 'Vérifier la signature'}
        </button>

        {!isVerifyFormValid && (
          <p style={styles.warningMessage}>Fichier, signature et clé publique sont requis.</p>
        )}
        {verifyError && <p role="alert" style={styles.errorMessage}>{verifyError}</p>}

        {verifyResult && (
          <div role="status" style={styles.verifyResult}>
            <p
              style={{
                ...styles.verdict,
                color: verifyResult.valid ? '#34d399' : '#f87171',
              }}
            >
              {verifyResult.valid
                ? 'Signature valide : le fichier n’a pas été modifié et la clé publique correspond.'
                : 'Signature invalide : fichier modifié, mauvaise clé publique ou mauvaise empreinte.'}
            </p>
            {verifyResult.digestMatch !== null && (
              <p
                style={{
                  ...styles.verdict,
                  color: verifyResult.digestMatch ? '#34d399' : '#f87171',
                }}
              >
                {verifyResult.digestMatch
                  ? 'Empreinte du fichier identique à l’empreinte attendue.'
                  : 'Empreinte du fichier différente de l’empreinte attendue.'}
              </p>
            )}
            <p style={styles.monoLine}>
              Empreinte du fichier ({verifyResult.hashAlgorithm}) : {verifyResult.fileDigest}
            </p>
            <p style={styles.monoLine}>
              Clé publique : RSA {verifyResult.keySize} bits, empreinte{' '}
              {verifyResult.publicKeyFingerprint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#070a0f',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '1.5rem 2rem',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
  algoButtonSelected: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: '1.25rem',
  },
  helpText: { fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '0.5rem' },
  subHelpText: { fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' },
  inputGroup: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' },
  selectInput: {
    width: '100%',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.85rem',
    outline: 'none',
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
    gap: '0.75rem',
  },
  dropText: { fontSize: '0.85rem', color: '#e2e8f0', overflowWrap: 'anywhere' },
  browseButton: {
    backgroundColor: '#090d16',
    border: '1px solid #374151',
    color: '#e5e7eb',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  verifyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginTop: '0.5rem',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.65rem 0.75rem',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  pemTextarea: {
    width: '100%',
    height: '135px',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  resultTextarea: {
    width: '100%',
    height: '90px',
    backgroundColor: '#080d16',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  monoLine: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontFamily: 'monospace',
    overflowWrap: 'anywhere',
    margin: '0.6rem 0 0',
  },
  privateKeyBox: {
    marginTop: '1.25rem',
    padding: '1rem',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '8px',
  },
  warningMessage: { color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.5rem' },
  errorMessage: { color: '#f87171', fontSize: '0.85rem', marginTop: '0.75rem' },
  verifyResult: { marginTop: '1rem' },
  verdict: { fontSize: '0.9rem', fontWeight: '600', margin: '0.25rem 0' },
  submitButton: {
    borderRadius: '6px',
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: 'none',
    width: 'fit-content',
    marginTop: '1.5rem',
  },
  secondaryButton: {
    marginTop: '0.5rem',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.85rem',
    border: '1px solid #374151',
    backgroundColor: '#1e293b',
    color: '#ffffff',
    cursor: 'pointer',
  },
  activeSubmitButton: { backgroundColor: '#3b82f6', color: '#ffffff', cursor: 'pointer' },
  disabledSubmitButton: { backgroundColor: '#1d2d44', color: '#475569', cursor: 'not-allowed' },
};

export default SignaturePage;
