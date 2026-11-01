import httpx
from ..config import settings

class SMSService:
    def send(self, to: str, message: str) -> bool:
        if not to:
            return False
        provider = settings.sms_provider.lower()
        if provider == "console":
            print(f"[SMS -> {to}] {message}")
            return True
        if provider == "kavenegar":
            if not settings.sms_api_key:
                return False
            url = f"https://api.kavenegar.com/v1/{settings.sms_api_key}/sms/send.json"
            data = {"receptor": to, "message": message}
            if settings.sms_sender:
                data["sender"] = settings.sms_sender
            try:
                r = httpx.post(url, data=data, timeout=15)
                return r.is_success
            except Exception:
                return False
        return False

sms_service = SMSService()
