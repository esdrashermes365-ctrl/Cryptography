import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Nom dynamique du tenant
  const tenantName = user?.tenant?.name || 'Tenant invité';

  return (
    <header className="w-full bg-[#0b0f17] border-b border-slate-800/80 px-6 py-3 flex items-center justify-between text-sm">
      {/* Fil d'Ariane dynamique à gauche */}
      <div className="flex items-center space-x-2 text-slate-400 font-normal">
        <span className="text-sky-400 hover:text-sky-300 cursor-pointer transition-colors">
          Espace
        </span>
        <span className="text-slate-600">/</span>
        <span className="text-sky-400 hover:text-sky-300 cursor-pointer transition-colors">
          {tenantName}
        </span>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold">
          Vue d’ensemble
        </span>
      </div>

      {/* Badges et Profil Utilisateur à droite */}
      <div className="flex items-center space-x-3">
        <div className="border border-emerald-500/40 bg-emerald-950/20 text-emerald-400 text-xs px-3 py-1.5 rounded-md font-medium">
          API : connectée
        </div>

        <div className="border border-blue-500/40 bg-blue-950/20 text-blue-400 text-xs px-3 py-1.5 rounded-md font-medium">
          Connexion sécurisée Argon2id
        </div>

        <div className="relative" ref={dropdownRef}>
          {user ? (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 border border-slate-800 bg-[#111622] hover:bg-[#161f30] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-blue-600/80 text-white flex items-center justify-center text-[10px] font-bold">
                {getInitials(user.fullName)}
              </span>
              <span>{user.fullName}</span>
            </button>
          ) : (
            <a
              href="/login"
              className="border border-slate-800 bg-[#111622] hover:bg-[#161f30] text-slate-300 hover:text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors inline-block"
            >
              Se connecter
            </a>
          )}

          {isDropdownOpen && user && (
            <div className="absolute right-0 mt-2 w-44 bg-[#111622] border border-slate-800 rounded-lg shadow-2xl py-1.5 z-50">
              <a
                href="/profile"
                className="block px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#182030] transition-colors"
              >
                Mon compte
              </a>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-red-400 hover:bg-[#182030] transition-colors"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}