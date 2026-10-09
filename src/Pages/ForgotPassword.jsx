import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/forgot-password', { method: 'POST', body: { email } });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

        {/* Section de gauche */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Espace cryptographie
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Chiffrement, hashage et signature de fichiers par tenant,<br />
            avec un reçu d'audit pour chaque opération.
          </p>
        </div>

        {/* Section de droite - Formulaire */}
        <div className="bg-[#111622] border border-slate-800/80 rounded-xl p-8 shadow-xl max-w-md w-full justify-self-center md:justify-self-end">
          <h2 className="text-xl font-semibold mb-2 text-white">Mot de passe oublié</h2>

          {message ? (
            <div className="space-y-4">
              <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-md text-emerald-400 text-xs leading-relaxed">
                {message}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Le lien n’est utilisable qu’une fois et expire rapidement. Pensez à regarder dans
                les courriers indésirables.
              </p>
              <Link to="/login" className="inline-block text-xs text-[#4c8bf5] hover:underline font-medium">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Saisissez l’adresse e-mail de votre compte. Nous vous envoyons un lien pour choisir
                un nouveau mot de passe.
              </p>

              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-xs">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="nom@exemple.fr"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4c8bf5] hover:bg-[#3b79e3] text-white font-medium py-2.5 rounded-md text-sm transition-colors mt-2 disabled:opacity-50"
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
                </button>
              </form>

              <div className="mt-6 text-xs text-slate-400">
                <Link to="/login" className="text-[#4c8bf5] hover:underline font-medium">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
