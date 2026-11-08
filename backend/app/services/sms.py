import logging

import httpx
from ..config import settings

logger = logging.getLogger(__name__)


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
                logger.error("SMS provider is kavenegar but SMS_API_KEY is not configured.")
                return False
            url = f"https://api.kavenegar.com/v1/{settings.sms_api_key}/sms/send.json"
            data = {"receptor": to, "message": message}
            if settings.sms_sender:
                data["sender"] = settings.sms_sender
            try:
                r = httpx.post(url, data=data, timeout=15)
                r.raise_for_status()
                return True
            except httpx.HTTPStatusError as error:
                logger.error("Kavenegar rejected an SMS request with HTTP %s.", error.response.status_code)
                return False
            except httpx.RequestError:
                logger.exception("Kavenegar SMS request failed.")
                return False
        if provider == "smsir":
            if not settings.sms_api_key:
                logger.error("SMS provider is smsir but SMS_API_KEY is not configured.")
                return False
            try:
                line_number = int(settings.sms_sender)
            except (TypeError, ValueError):
                logger.error("SMS provider is smsir but SMS_SENDER must be the SMS.ir line number.")
                return False

            try:
                response = httpx.post(
                    "https://api.sms.ir/v1/send/bulk",
                    json={
                        "lineNumber": line_number,
                        "messageText": message,
                        "mobiles": [to],
                        "sendDateTime": None,
                    },
                    headers={
                        "X-API-KEY": settings.sms_api_key,
                        "Accept": "application/json",
                    },
                    timeout=15,
                )
                response.raise_for_status()
                try:
                    result = response.json()
                except ValueError:
                    logger.error("SMS.ir returned a non-JSON success response.")
                    return False

                if not isinstance(result, dict) or result.get("status") != 1:
                    provider_message = result.get("message") if isinstance(result, dict) else None
                    logger.error(
                        "SMS.ir did not accept the SMS request (status=%s, message=%s).",
                        result.get("status") if isinstance(result, dict) else None,
                        provider_message,
                    )
                    return False

                data = result.get("data")
                if isinstance(data, dict):
                    logger.info(
                        "SMS.ir accepted SMS request (pack_id=%s, message_ids=%s).",
                        data.get("packId"),
                        data.get("messageIds"),
                    )
                else:
                    logger.info("SMS.ir accepted SMS request.")
                return True
            except httpx.HTTPStatusError as error:
                try:
                    result = error.response.json()
                except ValueError:
                    result = None
                provider_status = result.get("status") if isinstance(result, dict) else None
                provider_message = result.get("message") if isinstance(result, dict) else None
                logger.error(
                    "SMS.ir rejected an SMS request with HTTP %s (status=%s, message=%s).",
                    error.response.status_code,
                    provider_status,
                    provider_message,
                )
                return False
            except httpx.RequestError:
                logger.exception("SMS.ir request failed.")
                return False
        logger.error("Unsupported SMS provider configured: %s", provider)
        return False

    def send_smsir_template(self, to: str, template_id: str, parameters: dict[str, str]) -> bool:
        if not to:
            return False
        if settings.sms_provider.lower() != "smsir":
            logger.error("SMS.ir template sending requires SMS_PROVIDER=smsir.")
            return False
        if not settings.sms_api_key:
            logger.error("SMS provider is smsir but SMS_API_KEY is not configured.")
            return False
        try:
            template_number = int(template_id)
        except (TypeError, ValueError):
            logger.error("An SMS.ir template ID must be configured for template sending.")
            return False

        try:
            response = httpx.post(
                "https://api.sms.ir/v1/send/verify",
                json={
                    "mobile": to,
                    "templateId": template_number,
                    "parameters": [
                        {"name": name, "value": value}
                        for name, value in parameters.items()
                    ],
                },
                headers={
                    "X-API-KEY": settings.sms_api_key,
                    "Accept": "application/json",
                },
                timeout=15,
            )
            response.raise_for_status()
            try:
                result = response.json()
            except ValueError:
                logger.error("SMS.ir returned a non-JSON template-send response.")
                return False

            if not isinstance(result, dict) or result.get("status") != 1:
                logger.error(
                    "SMS.ir did not accept the template SMS (status=%s, message=%s).",
                    result.get("status") if isinstance(result, dict) else None,
                    result.get("message") if isinstance(result, dict) else None,
                )
                return False

            data = result.get("data")
            message_id = data.get("messageId") if isinstance(data, dict) else None
            if not message_id:
                logger.error("SMS.ir accepted the template request without returning a message ID.")
                return False

            logger.info("SMS.ir accepted template SMS (message_id=%s).", message_id)
            return True
        except httpx.HTTPStatusError as error:
            try:
                result = error.response.json()
            except ValueError:
                result = None
            logger.error(
                "SMS.ir rejected the template SMS with HTTP %s (status=%s, message=%s).",
                error.response.status_code,
                result.get("status") if isinstance(result, dict) else None,
                result.get("message") if isinstance(result, dict) else None,
            )
            return False
        except httpx.RequestError:
            logger.exception("SMS.ir template request failed.")
            return False

sms_service = SMSService()
