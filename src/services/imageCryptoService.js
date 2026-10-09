import { decodeBase64, encodeBase64 } from './cryptoService';

const STEGO_MAGIC = new TextEncoder().encode('CRYPTOIMG1');
const STEGO_HEADER_LENGTH = STEGO_MAGIC.length + 4;
const CHANNELS_PER_PIXEL = 3;

export const createImageCanvas = async (source) => {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('Impossible de préparer cette image dans le navigateur.');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, context };
};

export const canvasToPng = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Impossible de créer le fichier PNG.'));
    }, 'image/png');
  });

export const blobToBase64 = async (blob) =>
  encodeBase64(new Uint8Array(await blob.arrayBuffer()));

const writeBits = (pixels, bytes) => {
  const requiredBits = bytes.length * 8;
  if (requiredBits > Math.floor((pixels.length / 4) * CHANNELS_PER_PIXEL)) {
    throw new Error(
      'Le message chiffré est trop volumineux pour cette image. Essayez une image plus grande ou un message plus court.',
    );
  }

  let bitIndex = 0;
  for (let pixelIndex = 0; bitIndex < requiredBits; pixelIndex += 4) {
    for (let channel = 0; channel < 3 && bitIndex < requiredBits; channel += 1) {
      const byte = bytes[bitIndex >> 3];
      const bit = (byte >> (7 - (bitIndex & 7))) & 1;
      pixels[pixelIndex + channel] = (pixels[pixelIndex + channel] & 0xfe) | bit;
      bitIndex += 1;
    }
  }
};

const readBytes = (pixels, byteLength) => {
  const requiredBits = byteLength * 8;
  if (requiredBits > Math.floor((pixels.length / 4) * CHANNELS_PER_PIXEL)) {
    throw new Error('Aucun message caché valide n’a été trouvé dans cette image PNG.');
  }
  const bytes = new Uint8Array(byteLength);
  let bitIndex = 0;
  for (let pixelIndex = 0; bitIndex < requiredBits; pixelIndex += 4) {
    for (let channel = 0; channel < 3 && bitIndex < requiredBits; channel += 1) {
      bytes[bitIndex >> 3] |=
        (pixels[pixelIndex + channel] & 1) << (7 - (bitIndex & 7));
      bitIndex += 1;
    }
  }
  return bytes;
};

export const embedCiphertextInImage = async (file, cipherText) => {
  const { canvas, context } = await createImageCanvas(file);
  const textBytes = new TextEncoder().encode(cipherText);
  const header = new Uint8Array(STEGO_HEADER_LENGTH);
  header.set(STEGO_MAGIC);
  new DataView(header.buffer).setUint32(STEGO_MAGIC.length, textBytes.length);
  const payload = new Uint8Array(header.length + textBytes.length);
  payload.set(header);
  payload.set(textBytes, header.length);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  writeBits(imageData.data, payload);
  context.putImageData(imageData, 0, 0);
  return canvasToPng(canvas);
};

export const extractCiphertextFromImage = async (file) => {
  const { canvas, context } = await createImageCanvas(file);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const header = readBytes(pixels, STEGO_HEADER_LENGTH);
  if (!STEGO_MAGIC.every((byte, index) => header[index] === byte)) {
    throw new Error('Cette image ne contient pas de message chiffré caché reconnu.');
  }

  const payloadLength = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength,
  ).getUint32(STEGO_MAGIC.length);
  const capacity = Math.floor((pixels.length / 4) * CHANNELS_PER_PIXEL);
  if (
    payloadLength === 0 ||
    (STEGO_HEADER_LENGTH + payloadLength) * 8 > capacity
  ) {
    throw new Error('Le message caché dans cette image est incomplet ou invalide.');
  }

  const payload = readBytes(pixels, STEGO_HEADER_LENGTH + payloadLength).slice(
    STEGO_HEADER_LENGTH,
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(payload);
};

export const createVisibleCiphertextImage = async (file, ciphertext) => {
  const { canvas, context } = await createImageCanvas(file);
  const envelope = JSON.parse(ciphertext);
  const text = envelope.data;
  const fontSize = Math.max(10, Math.min(18, Math.floor(canvas.width / 60)));
  const lineHeight = fontSize * 1.4;
  const padding = fontSize;
  const maxTextWidth = canvas.width - padding * 2;
  context.font = `${fontSize}px monospace`;

  const lines = [];
  let line = '';
  for (const character of text) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxTextWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const panelHeight = Math.min(
    canvas.height,
    padding * 2 + lineHeight * (lines.length + 1),
  );
  context.fillStyle = 'rgba(0, 0, 0, 0.78)';
  context.fillRect(0, canvas.height - panelHeight, canvas.width, panelHeight);
  context.fillStyle = '#ffffff';
  context.textBaseline = 'top';
  context.fillText(
    'TEXTE CHIFFRÉ — voir le fichier JSON pour les paramètres',
    padding,
    canvas.height - panelHeight + padding,
  );
  const visibleLineCapacity = Math.max(
    0,
    Math.floor((panelHeight - padding * 2 - lineHeight) / lineHeight),
  );
  lines.slice(0, visibleLineCapacity).forEach((cipherLine, index) => {
    context.fillText(
      cipherLine,
      padding,
      canvas.height - panelHeight + padding + lineHeight * (index + 1),
    );
  });
  return canvasToPng(canvas);
};

export const createMaskedRegionPackage = async ({
  file,
  rectangle,
  encryptData,
  algorithm,
  publicKey,
}) => {
  const { canvas, context } = await createImageCanvas(file);
  const left = Math.max(0, Math.floor(Math.min(rectangle.x, rectangle.x + rectangle.width)));
  const top = Math.max(0, Math.floor(Math.min(rectangle.y, rectangle.y + rectangle.height)));
  const right = Math.min(
    canvas.width,
    Math.ceil(Math.max(rectangle.x, rectangle.x + rectangle.width)),
  );
  const bottom = Math.min(
    canvas.height,
    Math.ceil(Math.max(rectangle.y, rectangle.y + rectangle.height)),
  );
  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) {
    throw new Error('Sélectionnez une zone non vide dans l’image.');
  }

  const region = context.getImageData(left, top, width, height);
  const result = await encryptData({
    payload: JSON.stringify({
      type: 'image-region-pixels-v1',
      width,
      height,
      pixels: encodeBase64(region.data),
    }),
    algorithm,
    publicKey,
  });

  context.fillStyle = '#000000';
  context.fillRect(left, top, width, height);
  const preview = await canvasToPng(canvas);
  return {
    cipherText: JSON.stringify({
      version: 1,
      type: 'image-region-v1',
      algorithm,
      fileName: file.name,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      rectangle: { x: left, y: top, width, height },
      maskedImage: await blobToBase64(preview),
      encryptedRegion: JSON.parse(result.cipherText),
    }),
    key: result.key,
    preview,
  };
};

export const restoreMaskedRegion = async (container, plaintext) => {
  let region;
  try {
    region = JSON.parse(plaintext);
  } catch {
    throw new Error('Le contenu déchiffré de la zone est invalide.');
  }

  const { rectangle } = container;
  const validNumber = (value) => Number.isInteger(value) && value >= 0;
  if (
    container.version !== 1 ||
    typeof container.fileName !== 'string' ||
    region.type !== 'image-region-pixels-v1' ||
    !validNumber(container.imageWidth) ||
    !validNumber(container.imageHeight) ||
    !validNumber(rectangle?.x) ||
    !validNumber(rectangle?.y) ||
    !validNumber(rectangle?.width) ||
    !validNumber(rectangle?.height) ||
    rectangle.width < 1 ||
    rectangle.height < 1 ||
    rectangle.x + rectangle.width > container.imageWidth ||
    rectangle.y + rectangle.height > container.imageHeight ||
    region.width !== rectangle.width ||
    region.height !== rectangle.height ||
    typeof container.maskedImage !== 'string' ||
    typeof region.pixels !== 'string'
  ) {
    throw new Error('Le fichier de zone chiffrée n’a pas un format valide.');
  }

  const pixelBytes = decodeBase64(region.pixels);
  if (pixelBytes.length !== rectangle.width * rectangle.height * 4) {
    throw new Error('La zone déchiffrée a une taille invalide.');
  }

  const imageBlob = new Blob([decodeBase64(container.maskedImage)], {
    type: 'image/png',
  });
  const { canvas, context } = await createImageCanvas(imageBlob);
  if (canvas.width !== container.imageWidth || canvas.height !== container.imageHeight) {
    throw new Error('Les dimensions de l’image ne correspondent pas au fichier chiffré.');
  }
  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(pixelBytes),
      rectangle.width,
      rectangle.height,
    ),
    rectangle.x,
    rectangle.y,
  );
  return canvasToPng(canvas);
};
