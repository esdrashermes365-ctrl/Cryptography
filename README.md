# Espace cryptographie

Application web : interface React (Vite, Tailwind) et API FastAPI (SQLAlchemy, PostgreSQL).
Chaque compte a un tenant. L'e-mail du compte et celui du tenant sont chiffrés en AES-256-GCM dans la base.

## Fonctions

- Inscription, connexion (cookie de session httpOnly), déconnexion
- Mot de passe oublié : lien par e-mail, valable une fois, qui ferme les sessions ouvertes
- Chiffrement et déchiffrement : AES-128/256-GCM, ChaCha20-Poly1305, AES-256-CBC, RSA-OAEP
- Hashage et vérification d'empreinte : Argon2id, Bcrypt, SHA-256, SHA-512
- Signature de fichiers RSA-PSS (SHA-256 ou SHA-512) avec vérification et comparaison d'empreintes
- Journal d'audit paginé des opérations cryptographiques, isolé par compte et sans contenu sensible

Non réalisé : clés API pour tenants externes.

## Installation

```
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
copy .env.example .env
python -m app.generate_keys --all     # copiez les 3 clés dans .env
python -m app.create_tables           # crée les tables dans la base PostgreSQL configurée
```

La base PostgreSQL doit déjà exister (par exemple sur Neon). Copiez son URL de connexion dans `DATABASE_URL` dans `backend/.env`.
Pour une base existante (comptes déjà créés) : sauvegardez-la, puis `python -m app.migrate_v2`.
Pour ajouter le journal d'audit à cette base, lancez ensuite `python -m app.migrate_audit_logs`.
Ne régénérez jamais ENCRYPTION_SECRET_KEY sur une base qui contient des données.

## Lancement

```
cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
npm install && npm run dev
```

En développement, sans SMTP_HOST dans .env, le lien de mot de passe oublié s'affiche dans le terminal d'uvicorn.
En production (APP_ENV=production), SMTP_HOST est obligatoire.

## Déploiement (Neon + Render)

1. Créez une base PostgreSQL sur Neon et copiez son URL de connexion dans `DATABASE_URL`. Utilisez l'URL PostgreSQL fournie par Neon.
2. Dans `backend`, copiez `.env.example` vers `.env`, générez les clés avec `python -m app.generate_keys --all`, puis renseignez les trois clés distinctes dans `.env`.
3. Avec cet environnement chargé, lancez une fois `python -m app.create_tables` pour créer les tables Neon.
4. Importez le dépôt sur Render en utilisant le Blueprint `render.yaml`. Remplissez les variables demandées avec la même URL de Neon et les mêmes trois clés.
5. Configurez `CORS_ORIGINS` et `FRONTEND_URL` avec l'origine exacte du site Vercel (par exemple `https://mon-site.vercel.app`, sans chemin ni slash final). Configurez `VITE_API_URL` sur Vercel avec l'URL Render, puis redéployez le front.
6. Fournissez à Render les identifiants SMTP d'un fournisseur d'e-mail. Ils sont obligatoires en production pour la réinitialisation de mot de passe.

Le Blueprint règle les cookies pour les domaines Vercel/Render distincts (`COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`). Gardez les clés secrètes hors du dépôt et ne régénérez pas `ENCRYPTION_SECRET_KEY` après avoir enregistré des données.

## Tests

```
cd backend && pip install -r requirements-dev.txt python-multipart && python -m pytest
```
