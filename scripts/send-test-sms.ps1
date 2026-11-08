$ErrorActionPreference = "Stop"

$phone = Read-Host "Recipient phone number"
if ([string]::IsNullOrWhiteSpace($phone)) {
    throw "A recipient phone number is required."
}

$templateType = Read-Host "Template type (teacher/parent)"
if ($templateType -notin @("teacher", "parent")) {
    throw "Template type must be teacher or parent."
}

$name = Read-Host "Name for the SMS template"
if ([string]::IsNullOrWhiteSpace($name)) {
    throw "A name is required."
}

$confirmation = Read-Host "This sends one real SMS and may incur a charge. Type SEND to continue"
if ($confirmation -cne "SEND") {
    Write-Output "SMS cancelled."
    exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonCode = @'
import os
import sys

from app.config import settings
from app.services.sms import sms_service

if settings.sms_provider.lower() != "smsir":
    print(f"SMS provider is {settings.sms_provider!r}; set SMS_PROVIDER=smsir first.")
    sys.exit(2)

phone = os.environ.get("FASTICK_TEST_PHONE", "")
name = os.environ.get("FASTICK_TEST_NAME", "")
template_type = os.environ.get("FASTICK_TEST_TEMPLATE", "")
if not phone.strip() or not name.strip() or template_type not in {"teacher", "parent"}:
    print("FASTICK_TEST_PHONE, FASTICK_TEST_NAME, and a valid FASTICK_TEST_TEMPLATE are required.")
    sys.exit(2)

template_id = (
    settings.sms_ir_teacher_template_id
    if template_type == "teacher"
    else settings.sms_ir_parent_template_id
)
accepted = sms_service.send_smsir_template(
    phone,
    template_id,
    {"NAME": name},
)
print("Provider accepted the SMS request." if accepted else "Provider did not accept the SMS request.")
sys.exit(0 if accepted else 1)
'@
$pythonCodeBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pythonCode))
$pythonCommand = "import base64; exec(base64.b64decode('$pythonCodeBase64'))"

$dockerArgs = @(
    "compose", "exec", "-T",
    "-e", "FASTICK_TEST_PHONE=$phone",
    "-e", "FASTICK_TEST_NAME=$name",
    "-e", "FASTICK_TEST_TEMPLATE=$templateType",
    "backend", "python", "-c", $pythonCommand
)

Push-Location $repoRoot
try {
    & docker @dockerArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
