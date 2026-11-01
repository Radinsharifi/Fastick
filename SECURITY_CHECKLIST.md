# Security checklist before production

- [ ] Replace all default passwords and SECRET_KEY.
- [ ] Force HTTPS and HSTS.
- [ ] Remove public PostgreSQL port from docker-compose.
- [ ] Configure firewall: expose only 80/443 and restricted SSH.
- [ ] Add login rate limit and account lockout/backoff.
- [ ] Add OTP-based password reset.
- [ ] Add forced password change for imported staff accounts.
- [ ] Add refresh-token/session revocation strategy.
- [ ] Run tenant-isolation tests for every endpoint.
- [ ] Add audit-log viewer and export.
- [ ] Add encrypted off-server database backups.
- [ ] Test restore procedure.
- [ ] Add monitoring/alerting for API errors and disk usage.
- [ ] Add privacy policy/data-retention policy for student records.
- [ ] Ensure SMS credentials are only environment secrets.
