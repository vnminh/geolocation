import resend

from app.config import settings


def send_temporary_password_email(email: str, temp_password: str) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is required to send password reset emails")

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.resend_from_email,
            "to": [email],
            "subject": "Your temporary password",
            "html": (
                "<p>Your temporary password has been reset.</p>"
                f"<p><strong>{temp_password}</strong></p>"
                "<p>Sign in with this password and change it as soon as possible.</p>"
            ),
        }
    )