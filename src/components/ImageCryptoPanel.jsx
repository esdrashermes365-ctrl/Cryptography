import { useEffect, useRef, useState } from 'react';
import { encryptData } from '../services/cryptoService';
import {
  createMaskedRegionPackage,
  createVisibleCiphertextImage,
  embedCiphertextInImage,
} from '../services/imageCryptoService';
import { downloadFile } from '../services/fileService';

const MODES = [
  { id: 'visible', label: 'Texte chiffré visible' },
  { id: 'hidden', label: 'Message caché dans le PNG' },
  { id: 'region', label: 'Chiffrer une zone' },
];

const ImageCryptoPanel = ({
  file,
  algorithm,
  publicKey,
  hasResult,
  onStart,
  onResult,
  onError,
}) => {
  const canvasRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const selectionStartRef = useRef(null);
  const [mode, setMode] = useState('visible');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState(null);
  const [imageReady, setImageReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [imageResult, setImageResult] = useState(null);

  useEffect(() => {
    let active = true;
    let bitmap;

    createImageBitmap(file)
      .then((loadedBitmap) => {
        if (!active) {
          loadedBitmap.close();
          return;
        }
        bitmap = loadedBitmap;
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Impossible de lire cette image.');
        context.drawImage(bitmap, 0, 0);
        imageCanvasRef.current = canvas;
        setImageReady(true);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Impossible de lire cette image.');
      });

    return () => {
      active = false;
      bitmap?.close();
      imageCanvasRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const displayCanvas = canvasRef.current;
    const sourceCanvas = imageCanvasRef.current;
    if (!displayCanvas || !sourceCanvas || !imageReady) return;
    displayCanvas.width = sourceCanvas.width;
    displayCanvas.height = sourceCanvas.height;
    const context = displayCanvas.getContext('2d');
    if (!context) return;
    context.drawImage(sourceCanvas, 0, 0);

    if (mode === 'region' && selection) {
      const left = Math.min(selection.x, selection.x + selection.width);
      const top = Math.min(selection.y, selection.y + selection.height);
      const width = Math.abs(selection.width);
      const height = Math.abs(selection.height);
      context.fillStyle = 'rgba(59, 130, 246, 0.35)';
      context.fillRect(left, top, width, height);
      context.strokeStyle = '#60a5fa';
      context.lineWidth = Math.max(2, sourceCanvas.width / 500);
      context.strokeRect(left, top, width, height);
    }
  }, [imageReady, mode, selection]);

  const getImagePoint = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(canvas.width, ((event.clientX - bounds.left) / bounds.width) * canvas.width),
      ),
      y: Math.max(
        0,
        Math.min(canvas.height, ((event.clientY - bounds.top) / bounds.height) * canvas.height),
      ),
    };
  };

  const handlePointerDown = (event) => {
    if (mode !== 'region') return;
    setImageResult(null);
    onStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getImagePoint(event);
    selectionStartRef.current = point;
    setSelection({ ...point, width: 0, height: 0 });
  };

  const handlePointerMove = (event) => {
    const start = selectionStartRef.current;
    if (!start || mode !== 'region') return;
    const point = getImagePoint(event);
    setSelection({
      x: start.x,
      y: start.y,
      width: point.x - start.x,
      height: point.y - start.y,
    });
  };

  const handlePointerUp = () => {
    selectionStartRef.current = null;
  };

  const handleEncryptImage = async () => {
    setError('');
    onError('');
    setImageResult(null);
    setIsProcessing(true);
    onStart();

    try {
      if (mode !== 'region' && !message.trim()) {
        throw new Error('Saisissez le message à chiffrer.');
      }
      if (mode === 'region' && algorithm === 'RSA-OAEP') {
        throw new Error(
          'RSA-OAEP ne convient pas au chiffrement de pixels. Choisissez AES ou ChaCha20-Poly1305.',
        );
      }

      if (mode === 'region') {
        if (!selection || Math.abs(selection.width) < 1 || Math.abs(selection.height) < 1) {
          throw new Error('Tracez une zone à chiffrer sur l’image.');
        }
        const result = await createMaskedRegionPackage({
          file,
          rectangle: selection,
          encryptData,
          algorithm,
          publicKey,
        });
        onResult({
          cipherText: result.cipherText,
          key: result.key,
          fileName: `${file.name}.region.encrypted.json`,
        });
        setImageResult({
          blob: result.preview,
          fileName: `${file.name}.region-masquee.png`,
          description: 'Aperçu avec la zone masquée. Le fichier JSON contient la zone chiffrée.',
          algorithm,
          publicKey,
        });
        return;
      }

      const encrypted = await encryptData({ payload: message, algorithm, publicKey });
      const imageBlob =
        mode === 'visible'
          ? await createVisibleCiphertextImage(file, encrypted.cipherText)
          : await embedCiphertextInImage(file, encrypted.cipherText);
      onResult({
        cipherText: encrypted.cipherText,
        key: encrypted.key,
        fileName: `${file.name}.encrypted.json`,
      });
      setImageResult({
        blob: imageBlob,
        fileName: `${file.name}.${mode === 'visible' ? 'cipher-visible' : 'message-cache'}.png`,
        description:
          mode === 'visible'
            ? 'L’image affiche le texte chiffré. Le fichier JSON séparé contient les paramètres nécessaires au déchiffrement.'
            : 'Le message chiffré est caché dans les pixels du PNG. Utilisez la page Déchiffrement pour l’extraire.',
        algorithm,
        publicKey,
      });
    } catch (operationError) {
      setError(operationError.message || 'Le traitement de l’image a échoué.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadImage = () => {
    if (!imageResult) return;
    downloadFile(imageResult.blob, imageResult.fileName, 'image/png');
  };

  return (
    <section style={styles.panel}>
      <h3 style={styles.heading}>Outils de chiffrement d’image</h3>
      <p style={styles.help}>
        Le fichier sélectionné est une image. Les résultats sont exportés en PNG ; choisissez
        une façon d’y ajouter un contenu chiffré.
      </p>
      <div style={styles.modeList} role="group" aria-label="Mode de chiffrement de l’image">
        {MODES.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id);
              setError('');
              setImageResult(null);
              onStart();
            }}
            style={{ ...styles.modeButton, ...(mode === id ? styles.selectedMode : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'region' ? (
        <p style={styles.help}>
          Tracez un rectangle sur l’image. La zone sera masquée ; le reste restera visible.
          La restauration nécessite le fichier JSON et la clé.
        </p>
      ) : (
        <>
          <label style={styles.label} htmlFor="image-encrypted-message">
            Message à chiffrer
          </label>
          <textarea
            id="image-encrypted-message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setImageResult(null);
              onStart();
            }}
            placeholder="Saisissez le texte secret"
            style={styles.textarea}
          />
          {mode === 'hidden' && (
            <p style={styles.help}>
              Le message est chiffré avant d’être caché dans les pixels. Un PNG est nécessaire
              pour préserver les données cachées ; sa capacité dépend de sa taille.
            </p>
          )}
        </>
      )}

      {imageReady ? (
        <canvas
          ref={canvasRef}
          aria-label="Aperçu de l’image. Tracez la zone à chiffrer en mode zone."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            ...styles.canvas,
            cursor: mode === 'region' ? 'crosshair' : 'default',
            touchAction: mode === 'region' ? 'none' : 'auto',
          }}
        />
      ) : (
        !error && <p style={styles.help}>Chargement de l’image...</p>
      )}

      {error && <p role="alert" style={styles.error}>{error}</p>}
      <button
        type="button"
        disabled={!imageReady || isProcessing}
        onClick={handleEncryptImage}
        style={{
          ...styles.actionButton,
          ...(!imageReady || isProcessing ? styles.disabledButton : {}),
        }}
      >
        {isProcessing ? 'Chiffrement en cours...' : 'Chiffrer pour cette image'}
      </button>

      {hasResult &&
        imageResult?.algorithm === algorithm &&
        imageResult?.publicKey === publicKey && (
        <div style={styles.result}>
          <p style={styles.help}>{imageResult.description}</p>
          <button type="button" onClick={handleDownloadImage} style={styles.actionButton}>
            Télécharger l’image PNG
          </button>
        </div>
      )}
    </section>
  );
};

const styles = {
  panel: {
    marginTop: '1.25rem',
    padding: '1rem',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    backgroundColor: '#080d16',
  },
  heading: {
    margin: '0 0 0.5rem',
    color: '#e2e8f0',
    fontSize: '1rem',
  },
  help: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  },
  modeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    margin: '1rem 0',
  },
  modeButton: {
    padding: '0.5rem 0.75rem',
    color: '#cbd5e1',
    backgroundColor: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  selectedMode: {
    color: '#ffffff',
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  label: {
    display: 'block',
    margin: '0.75rem 0 0.4rem',
    color: '#cbd5e1',
    fontSize: '0.85rem',
  },
  textarea: {
    width: '100%',
    minHeight: '90px',
    padding: '0.75rem',
    boxSizing: 'border-box',
    color: '#e2e8f0',
    backgroundColor: '#070a0f',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    resize: 'vertical',
  },
  canvas: {
    display: 'block',
    width: '100%',
    maxHeight: '60vh',
    marginTop: '1rem',
    objectFit: 'contain',
    border: '1px solid #1e293b',
    borderRadius: '6px',
  },
  error: {
    color: '#f87171',
    fontSize: '0.85rem',
  },
  actionButton: {
    marginTop: '0.75rem',
    padding: '0.65rem 1rem',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 0,
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  result: {
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #1e293b',
  },
};

export default ImageCryptoPanel;
