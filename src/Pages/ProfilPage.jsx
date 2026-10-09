import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProfilPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Mon compte</h1>
        <p className="mt-2 text-sm text-slate-400">
          Informations du compte actuellement connecté.
        </p>
      </div>

      {user ? (
        <section className="rounded-xl border border-slate-800 bg-[#111622] p-5">
          <dl className="divide-y divide-slate-800">
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm text-slate-400">Nom complet</dt>
              <dd className="text-sm text-white sm:col-span-2">
                {user.fullName || 'Non renseigné'}
              </dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm text-slate-400">Adresse email</dt>
              <dd className="text-sm text-white sm:col-span-2">
                {user.email || 'Non renseignée'}
              </dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm text-slate-400">Tenant</dt>
              <dd className="text-sm text-white sm:col-span-2">
                {user.tenant?.name || 'Non renseigné'}
                {user.tenant?.id && (
                  <span className="block text-xs text-slate-500">{user.tenant.id}</span>
                )}
              </dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm text-slate-400">E-mail du tenant</dt>
              <dd className="text-sm text-white sm:col-span-2">
                {user.tenant?.email || 'Non renseigné'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            La modification des informations du compte n’est pas encore
            disponible.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-[#111622] p-5">
          <p className="text-sm text-slate-400">
            Connectez-vous pour consulter les informations de votre compte.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Se connecter
          </Link>
        </section>
      )}
    </div>
  );
}
