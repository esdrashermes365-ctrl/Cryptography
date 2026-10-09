"""Envoi des e-mails transactionnels (mot de passe oublié)."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app import config

logger = logging.getLogger("app.mailer")


def send_reset_email(to_address: str, reset_link: str) -> None:
    """Envoie le lien de réinitialisation. Ne lève jamais : la réponse HTTP ne doit
    pas révéler si l'envoi a réussi (ni même si le compte existe)."""
    if not config.SMTP_HOST:
        # Développement uniquement : config.py refuse ce cas en production.
        logger.warning(
            "SMTP non configuré. Lien de réinitialisation pour %s : %s",
            to_address,
            reset_link,
        )
        return

    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe"
    message["From"] = config.SMTP_FROM
    message["To"] = to_address
    message.set_content(
        "Bonjour,\n\n"
        "Vous avez demandé la réinitialisation de votre mot de passe sur Espace Crypto.\n"
        f"Ouvrez ce lien pour en choisir un nouveau (valable {config.RESET_TOKEN_MINUTES} minutes, "
        "utilisable une seule fois) :\n\n"
        f"{reset_link}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : "
        "votre mot de passe reste inchangé.\n"
    )

    try:
        context = ssl.create_default_context()
        if config.SMTP_SSL:
            server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=10, context=context)
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10)
        with server:
            if not config.SMTP_SSL and config.SMTP_STARTTLS:
                server.starttls(context=context)
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(message)
    except Exception:  # noqa: BLE001 - on journalise sans exposer l'adresse ni le lien
        logger.exception("Échec de l'envoi de l'e-mail de réinitialisation")
