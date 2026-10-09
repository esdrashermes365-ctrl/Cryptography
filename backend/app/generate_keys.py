"""Génère des clés aléatoires de 32 octets pour backend/.env.

    python -m app.generate_keys          # JWT_SECRET_KEY et EMAIL_HASH_KEY
    python -m app.generate_keys --all    # ajoute ENCRYPTION_SECRET_KEY (nouvelle installation)

Ne regénérez JAMAIS ENCRYPTION_SECRET_KEY sur une base qui contient déjà des
données : les e-mails et les tenants chiffrés deviendraient illisibles.
"""
import secrets
import sys

names = ["JWT_SECRET_KEY", "EMAIL_HASH_KEY"]
if "--all" in sys.argv:
    names.insert(0, "ENCRYPTION_SECRET_KEY")
for name in names:
    print(f"{name}={secrets.token_hex(32)}")
