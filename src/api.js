export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function readDetail(data) {
  if (!data || !data.detail) return null;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        const field = item.loc?.filter((part) => part !== 'body').join('.');
        return field ? `${field} : ${item.msg}` : item.msg;
      })
      .filter(Boolean)
      .join(' ; ');
  }
  return data.detail;
}

// Les cookies de session sont httpOnly : le navigateur les envoie, le JavaScript ne les voit jamais.
// `body` part en JSON ; `formData` part en multipart (envoi de fichiers).
export async function apiFetch(path, { method = 'GET', body, formData } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez que l’API est démarrée.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(readDetail(data) || 'Une erreur est survenue.', response.status);
  }
  return data;
}
