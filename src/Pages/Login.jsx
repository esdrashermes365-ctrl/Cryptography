import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null); // Réinitialise l'erreur lors de la saisie
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Le serveur pose un cookie de session httpOnly ; rien n'est stocké côté JavaScript.
      const data = await apiFetch('/api/login', { method: 'POST', body: formData });
      setUser(data.user);
      navigate('/overview', { replace: true });
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
          <h2 className="text-xl font-semibold mb-6 text-white">
            Connexion
          </h2>

          {/* Affichage des messages d'erreur du backend */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                Haché avec Argon2id côté serveur.
              </p>
              <div className="pt-1 text-right">
                <Link to="/forgot-password" className="text-xs text-[#4c8bf5] hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4c8bf5] hover:bg-[#3b79e3] text-white font-medium py-2.5 rounded-md text-sm transition-colors mt-2 disabled:opacity-50"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          {/* Lien de redirection */}
          <div className="mt-6 text-xs text-slate-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-[#4c8bf5] hover:underline font-medium">
              Créer un compte
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}