import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiFetch('/api/register', { method: 'POST', body: formData });

      setSuccess(data.message || 'Compte créé avec succès. Vous pouvez vous connecter.');
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de la création du compte.');
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
          <h2 className="text-xl font-semibold mb-6 text-white">
            Créer un compte
          </h2>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-xs">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-md text-emerald-400 text-xs">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nom complet */}
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-300">
                Nom complet
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="w-full bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                Email (chiffré au repos)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="nom@exemple.fr"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Mot de passe */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                Mot de passe
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

            {/* Confirmer le mot de passe */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-[#0b0f17] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4c8bf5] hover:bg-[#3b79e3] text-white font-medium py-2.5 rounded-md text-sm transition-colors mt-2"
            >
              {loading ? 'Création en cours...' : 'Créer le compte'}
            </button>
          </form>

          {/* Lien de connexion */}
          <div className="mt-6 text-xs text-slate-400">
            Déjà inscrit ?{' '}
            <Link to="/login" className="text-[#4c8bf5] hover:underline font-medium">
              Se connecter
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}