import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../auth/AuthContext';

function PageHeading({ title, description }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#111622] p-5">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm text-white sm:col-span-2 break-all">{children}</dd>
    </div>
  );
}

export function TenantsPage() {
  const { user } = useAuth();
  const tenant = user?.tenant;
  const createdAt = tenant?.createdAt
    ? new Date(tenant.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Tenants"
        description="Consultez l’espace associé à votre compte."
      />
      {tenant ? (
        <InfoCard title="Tenant associé au compte">
          <dl className="divide-y divide-slate-800">
            <Field label="Nom">{tenant.name}</Field>
            <Field label="Identifiant">{tenant.id}</Field>
            <Field label="E-mail du tenant">{tenant.email}</Field>
            {createdAt && <Field label="Créé le">{createdAt}</Field>}
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            L’e-mail du tenant est chiffré en AES-256-GCM dans la base de données ; il n’est
            déchiffré que pour vous l’afficher.
          </p>
        </InfoCard>
      ) : (
        <InfoCard title="Aucun tenant chargé">
          <p className="text-sm text-slate-400">
            Connectez-vous pour afficher le tenant associé à votre compte.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Se connecter
          </Link>
        </InfoCard>
      )}
    </div>
  );
}

export function AuditLogsPage() {
  const [events, setEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    apiFetch(`/api/audit-logs?limit=${pageSize}&offset=${offset}`)
      .then((data) => {
        if (!active) return;
        setEvents(data.items);
        setHasMore(data.hasMore);
      })
      .catch((requestError) => {
        if (!active) return;
        setEvents([]);
        setHasMore(false);
        setError(requestError.message || 'Impossible de charger le journal d’audit.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [offset, refreshKey]);

  const refresh = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const changePage = (nextOffset) => {
    setLoading(true);
    setError('');
    setOffset(nextOffset);
  };

  const actionLabels = {
    encrypt: 'Chiffrement',
    decrypt: 'Déchiffrement',
    hash: 'Création d’empreinte',
    verify_hash: 'Vérification d’empreinte',
    sign: 'Signature',
    verify_signature: 'Vérification de signature',
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Audit et logs"
        description="Historique des opérations réalisées dans votre espace. Les textes, clés et fichiers ne sont jamais enregistrés."
      />
      <InfoCard title="Journal des opérations">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Les opérations sont conservées dans votre espace et visibles uniquement par vous.
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Actualiser
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-400">
            Chargement du journal…
          </p>
        ) : events.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Aucune opération enregistrée pour le moment.
          </p>
        ) : events.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-3">Date</th>
                    <th scope="col" className="px-3 py-3">Opération</th>
                    <th scope="col" className="px-3 py-3">Algorithme</th>
                    <th scope="col" className="px-3 py-3">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-400">
                        {new Date(event.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-3 text-white">
                        {actionLabels[event.action] || event.action}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{event.algorithm}</td>
                      <td className="px-3 py-3">
                        <span className={event.success ? 'text-emerald-400' : 'text-red-400'}>
                          {event.success ? 'Réussie' : 'Échouée'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => changePage(Math.max(0, offset - pageSize))}
                disabled={offset === 0}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-xs text-slate-500">
                Page {Math.floor(offset / pageSize) + 1}
              </span>
              <button
                type="button"
                onClick={() => changePage(offset + pageSize)}
                disabled={!hasMore}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </>
        ) : null}
      </InfoCard>
    </div>
  );
}

const ROUTES = [
  ['POST /api/register', 'Crée le compte et son tenant. Champs : fullName, email, password, confirmPassword.'],
  ['POST /api/login', 'Ouvre une session : le serveur pose un cookie httpOnly.'],
  ['GET /api/me', 'Renvoie le compte connecté et son tenant (identifiant, nom, e-mail).'],
  ['GET /api/audit-logs', 'Consulte le journal des opérations du compte connecté. Paramètres : limit (1–100), offset.'],
  ['POST /api/forgot-password', 'Envoie un lien de réinitialisation. La réponse est identique que le compte existe ou non.'],
  ['POST /api/reset-password', 'Change le mot de passe avec le jeton du lien. Le jeton sert une seule fois.'],
  ['POST /api/crypto/encrypt, /decrypt', 'Chiffre et déchiffre un texte (AES-GCM, ChaCha20-Poly1305, AES-CBC, RSA-OAEP).'],
  ['POST /api/hash/create, /verify', 'Crée et vérifie une empreinte (Argon2id, Bcrypt, SHA-256, SHA-512).'],
  ['POST /api/signature/sign, /verify', 'Signe un fichier en RSA-PSS et vérifie la signature, avec comparaison d’empreintes.'],
];

export function ApiTenantsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="API et tenants"
        description="Routes disponibles côté backend. Toutes, sauf l’inscription, la connexion et le mot de passe oublié, exigent une session ouverte."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ROUTES.map(([route, description]) => (
          <InfoCard key={route} title={route}>
            <p className="text-sm text-slate-400">{description}</p>
          </InfoCard>
        ))}
        <InfoCard title="Clés API pour des tenants externes">
          <p className="text-sm text-slate-400">
            Pas encore disponible : l’accès se fait uniquement par la session de l’interface.
          </p>
        </InfoCard>
      </div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Aide"
        description="Repères pour utiliser l’espace."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Mot de passe oublié">
          <p className="text-sm text-slate-400">
            Depuis la page de connexion, demandez un lien par e-mail. Il ne sert qu’une fois et
            ferme les sessions ouvertes sur le compte.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Demander un lien
          </Link>
        </InfoCard>
        <InfoCard title="Opérations">
          <p className="text-sm text-slate-400">
            Chiffrement, déchiffrement, hashage et signature sont exécutés par le serveur.
            Conservez les clés affichées : le serveur ne les garde pas.
          </p>
          <Link
            to="/encryption"
            className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Ouvrir les opérations
          </Link>
        </InfoCard>
      </div>
    </div>
  );
}
