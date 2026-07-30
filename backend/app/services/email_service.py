import logging

import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def _send(to: str, subject: str, html: str):
    """Base send function — wraps Resend API."""
    try:
        resend.Emails.send({
            "from": f"Resume Analyzer <{settings.FROM_EMAIL}>",
            "to": to,
            "subject": subject,
            "html": html,
        })
        logger.info("Email sent: to=%s, subject=%s", to, subject)
    except Exception as e:
        # Email failure should NEVER crash the main request
        logger.error("Email send failed: to=%s, subject=%s, error=%s", to, subject, e)


async def send_welcome_email(to: str, first_name: str):
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#10B981;margin-bottom:8px">Welcome to Resume Analyzer 🎯</h1>
      <p style="color:#555">Hi {first_name},</p>
      <p style="color:#555">You're all set. Here's what you can do:</p>
      <ul style="color:#555">
        <li>Upload your resume (PDF) or paste it</li>
        <li>Paste any job description</li>
        <li>Get an instant match score, missing skills, and ATS keywords</li>
      </ul>
      <a href="{settings.APP_URL}" style="display:inline-block;margin-top:24px;background:#10B981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        Start Analyzing →
      </a>
      <p style="color:#aaa;font-size:12px;margin-top:32px">
        All features are free with no limits. <a href="{settings.APP_URL}" style="color:#10B981">Start analyzing now.</a>
      </p>
    </div>
    """
    _send(to, "Welcome to Resume Analyzer 🎯", html)


async def send_upgrade_confirmation_email(to: str, first_name: str):
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#10B981">You're now a Pro member! 🚀</h1>
      <p style="color:#555">Hi {first_name}, your Pro subscription is active.</p>
      <p style="color:#555">What's unlocked:</p>
      <ul style="color:#555">
        <li>✅ Unlimited analyses every day</li>
        <li>✅ Job URL auto-scraping (LinkedIn, Indeed, Naukri)</li>
        <li>✅ PDF report export</li>
        <li>✅ Analysis history forever</li>
      </ul>
      <a href="{settings.APP_URL}" style="display:inline-block;margin-top:24px;background:#10B981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        Go to Dashboard →
      </a>
    </div>
    """
    _send(to, "Welcome to Pro — Resume Analyzer 🚀", html)
