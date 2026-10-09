"""Chiffrement et déchiffrement à la demande de l'utilisateur.

AES-128/256-GCM, ChaCha20-Poly1305, AES-256-CBC (authentifié par HMAC) et RSA-OAEP.
À ne pas confondre avec crypto.py, qui protège les données stockées en base.
Aucune clé fournie ou générée ici n'est conservée par le serveur.
"""
import base64
import binascii
import hashlib
import hmac
import os

from cryptography.exceptions import InvalidTag, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _decode_base64(value: str, field_name: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"{field_name} doit être encodé en base64 valide.") from exc


def _decode_key(value: str, expected_length: int) -> bytes:
    key = _decode_base64(value, "La clé")
    if len(key) != expected_length:
        raise ValueError(f"La clé doit contenir {expected_length} octets.")
    return key


def _decode_iv(value: str | None, expected_length: int) -> bytes:
    if not value:
        raise ValueError("Le vecteur d'initialisation est obligatoire.")
    iv = _decode_base64(value, "Le vecteur d'initialisation")
    if len(iv) != expected_length:
        raise ValueError(
            f"Le vecteur d'initialisation doit contenir {expected_length} octets."
        )
    return iv


def _derive_cbc_mac_key(key: bytes, iv: bytes) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=iv,
        info=b"cryptography/AES-256-CBC/HMAC-SHA256/v1",
    ).derive(key)


def _cbc_mac(key: bytes, iv: bytes, ciphertext: bytes) -> bytes:
    mac_key = _derive_cbc_mac_key(key, iv)
    return hmac.new(
        mac_key,
        b"AES-256-CBC\x00" + iv + ciphertext,
        hashlib.sha256,
    ).digest()


def encrypt_payload(
    payload: str,
    algorithm: str,
    user_key: str | None = None,
) -> dict[str, str | None]:
    payload_bytes = payload.encode("utf-8")

    if algorithm in ("AES-128-GCM", "AES-256-GCM"):
        key_length = 16 if algorithm == "AES-128-GCM" else 32
        key = (
            _decode_key(user_key, key_length)
            if user_key
            else AESGCM.generate_key(bit_length=key_length * 8)
        )
        iv = os.urandom(12)
        encrypted = AESGCM(key).encrypt(iv, payload_bytes, None)
        ciphertext, tag = encrypted[:-16], encrypted[-16:]
    elif algorithm == "ChaCha20-Poly1305":
        key = _decode_key(user_key, 32) if user_key else ChaCha20Poly1305.generate_key()
        iv = os.urandom(12)
        encrypted = ChaCha20Poly1305(key).encrypt(iv, payload_bytes, None)
        ciphertext, tag = encrypted[:-16], encrypted[-16:]
    elif algorithm == "AES-256-CBC":
        key = _decode_key(user_key, 32) if user_key else os.urandom(32)
        iv = os.urandom(16)
        pad_length = 16 - len(payload_bytes) % 16
        padded_payload = payload_bytes + bytes([pad_length]) * pad_length
        encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
        ciphertext = encryptor.update(padded_payload) + encryptor.finalize()
        tag = _cbc_mac(key, iv, ciphertext)
    elif algorithm == "RSA-OAEP":
        if user_key:
            try:
                public_key = serialization.load_pem_public_key(user_key.encode("utf-8"))
            except (TypeError, ValueError, UnsupportedAlgorithm) as exc:
                raise ValueError("La clé publique RSA n'est pas valide.") from exc
            if not isinstance(public_key, rsa.RSAPublicKey):
                raise ValueError("La clé publique fournie n'est pas une clé RSA.")
            private_key_pem = None
        else:
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            public_key = private_key.public_key()
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode("utf-8")

        try:
            ciphertext = public_key.encrypt(
                payload_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
        except ValueError as exc:
            raise ValueError("Le texte est trop long pour le chiffrement RSA-OAEP.") from exc

        return {
            "iv": None,
            "data": base64.b64encode(ciphertext).decode("ascii"),
            "tag": None,
            "key": private_key_pem,
        }
    else:
        raise ValueError("Algorithme non supporté.")

    return {
        "iv": base64.b64encode(iv).decode("ascii"),
        "data": base64.b64encode(ciphertext).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
        "key": base64.b64encode(key).decode("ascii"),
    }


def decrypt_payload(
    data: str,
    algorithm: str,
    key: str,
    iv: str | None = None,
    tag: str | None = None,
) -> str:
    ciphertext = _decode_base64(data, "Les données chiffrées")

    try:
        if algorithm in ("AES-128-GCM", "AES-256-GCM"):
            key_length = 16 if algorithm == "AES-128-GCM" else 32
            key_bytes = _decode_key(key, key_length)
            nonce = _decode_iv(iv, 12)
            tag_bytes = _decode_tag(tag, 16)
            plaintext = AESGCM(key_bytes).decrypt(nonce, ciphertext + tag_bytes, None)
        elif algorithm == "ChaCha20-Poly1305":
            key_bytes = _decode_key(key, 32)
            nonce = _decode_iv(iv, 12)
            tag_bytes = _decode_tag(tag, 16)
            plaintext = ChaCha20Poly1305(key_bytes).decrypt(
                nonce, ciphertext + tag_bytes, None
            )
        elif algorithm == "AES-256-CBC":
            key_bytes = _decode_key(key, 32)
            iv_bytes = _decode_iv(iv, 16)
            if not ciphertext or len(ciphertext) % 16:
                raise ValueError("Les données AES-CBC sont de longueur invalide.")
            supplied_tag = _decode_tag(tag, 32)
            expected_tag = _cbc_mac(key_bytes, iv_bytes, ciphertext)
            if not hmac.compare_digest(supplied_tag, expected_tag):
                raise ValueError("Les données chiffrées ou la clé sont invalides.")

            decryptor = Cipher(algorithms.AES(key_bytes), modes.CBC(iv_bytes)).decryptor()
            padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()
            pad_length = padded_plaintext[-1]
            if (
                pad_length < 1
                or pad_length > 16
                or padded_plaintext[-pad_length:] != bytes([pad_length]) * pad_length
            ):
                raise ValueError("Les données chiffrées ou la clé sont invalides.")
            plaintext = padded_plaintext[:-pad_length]
        elif algorithm == "RSA-OAEP":
            try:
                private_key = serialization.load_pem_private_key(
                    key.encode("utf-8"),
                    password=None,
                )
                if not isinstance(private_key, rsa.RSAPrivateKey):
                    raise ValueError("La clé privée fournie n'est pas une clé RSA.")
                plaintext = private_key.decrypt(
                    ciphertext,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None,
                    ),
                )
            except (TypeError, ValueError, UnsupportedAlgorithm) as exc:
                raise ValueError(
                    "La clé privée RSA ou les données sont invalides."
                ) from exc
        else:
            raise ValueError("Algorithme non supporté.")
    except InvalidTag as exc:
        raise ValueError("Les données chiffrées ou la clé sont invalides.") from exc

    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(
            "Les données déchiffrées ne sont pas du texte UTF-8 valide."
        ) from exc


def _decode_tag(value: str | None, expected_length: int) -> bytes:
    if not value:
        raise ValueError("Le tag d'authentification est obligatoire.")
    tag = _decode_base64(value, "Le tag d'authentification")
    if len(tag) != expected_length:
        raise ValueError(
            f"Le tag d'authentification doit contenir {expected_length} octets."
        )
    return tag
