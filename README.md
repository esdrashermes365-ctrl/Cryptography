# Espace cryptographie

Application web : interface React (Vite, Tailwind) et API FastAPI (SQLAlchemy, MySQL).
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
python -m app.init_db                 # crée la base MySQL
python -m app.create_tables
```

Base existante (comptes déjà créés) : sauvegardez-la, puis `python -m app.migrate_v2`.
Pour ajouter le journal d'audit à cette base, lancez ensuite `python -m app.migrate_audit_logs`.
Ne régénérez jamais ENCRYPTION_SECRET_KEY sur une base qui contient des données.

## Lancement

```
cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
npm install && npm run dev
```

En développement, sans SMTP_HOST dans .env, le lien de mot de passe oublié s'affiche dans le terminal d'uvicorn.
En production (APP_ENV=production), SMTP_HOST est obligatoire.

## Tests

```
cd backend && pip install -r requirements-dev.txt python-multipart && python -m pytest
```
