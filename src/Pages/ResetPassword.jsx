import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

// Le jeton arrive dans le fragment de l'URL (#token=...) : il n'est jamais envoyé au serveur web.
function readTokenFromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('token') || '';
}

export default function ResetPassword() {
  const [token] = useState(readTokenFromHash);
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [loading, setLoading] = useState(false);

  // On retire le jeton de la barre d'adresse (historique, copier-coller de l'URL).
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/reset-password', {
        method: 'POST',
        body: { token, ...formData },
      });
      setDone(data.message);
      setFormData({ password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const linkProblem = !token || /lien/i.test(error || '');

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
          <h2 className="text-xl font-semibold mb-6 text-white">Nouveau mot de passe</h2>

          {done ? (
            <div className="space-y-4">
              <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-md text-emerald-400 text-xs">
                {done}
              </div>
              <Link
                to="/login"
                className="block w-full text-center bg-[#4c8bf5] hover:bg-[#3b79e3] text-white font-medium py-2.5 rounded-md text-sm transition-colors"
              >
                Se connecter
              </Link>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-xs">
                Ce lien est incomplet. Ouvrez-le depuis l’e-mail reçu ou demandez-en un nouveau.
              </div>
              <Link to="/forgot-password" className="inline-block text-xs text-[#4c8bf5] hover:underline font-medium">
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-xs">
                  {error}
                  {linkProblem && (
                    <>
                      {' '}
                      <Link to="/forgot-password" className="underline">
                        Demander un nouveau lien
                      </Link>
                    </>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                    Nouveau mot de passe
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleChange}
                      className="flex-1 bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="bg-[#182030] hover:bg-[#202a3f] border border-slate-700/60 rounded-md px-3 py-2 text-xs text-slate-300 transition-colors"
                    >
                      {showPassword ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  <p className="text-[#e2933a] text-xs pt-1">
                    12 caractères minimum. Haché avec Argon2id côté serveur.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4c8bf5] hover:bg-[#3b79e3] text-white font-medium py-2.5 rounded-md text-sm transition-colors mt-2 disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
