from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.config import get_settings


def _build_message(to_email: str, code: str) -> EmailMessage:
    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = f"{code} is your MatchPoint verification code"
    msg["From"] = f"{settings.smtp_from_name} <{settings.mail_from}>"
    msg["To"] = to_email

    minutes = settings.otp_expire_minutes
    msg.set_content(
        "MATCHPOINT // ACCESS TERMINAL\n\n"
        f"Your verification code is: {code}\n\n"
        f"It expires in {minutes} minutes. If you did not request this, ignore this email.\n"
    )
    msg.add_alternative(
        f"""\
        <div style="font-family:'JetBrains Mono',monospace;background:#0B0B0B;color:#F2EEE2;padding:32px;">
          <p style="color:#D8FF14;letter-spacing:0.2em;font-size:11px;font-weight:800;text-transform:uppercase;margin:0 0 16px;">
            MATCHPOINT // ACCESS TERMINAL
          </p>
          <p style="margin:0 0 8px;font-size:13px;">Your verification code:</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:0.3em;color:#D8FF14;margin:0 0 16px;">{code}</p>
          <p style="font-size:12px;color:#9a9a9a;margin:0;">
            Expires in {minutes} minutes. If you did not request this, ignore this email.
          </p>
        </div>
        """,
        subtype="html",
    )
    return msg


def _send_sync(msg: EmailMessage) -> None:
    settings = get_settings()
    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)


async def send_otp_email(to_email: str, code: str) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.mail_from:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured (set SMTP_HOST / SMTP_USER).",
        )

    msg = _build_message(to_email, code)
    try:
        await asyncio.to_thread(_send_sync, msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to send verification email. Please try again shortly.",
        ) from exc
