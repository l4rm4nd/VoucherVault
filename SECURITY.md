# Security Policy

## Supported Versions

Security fixes are provided for the latest release only. Please update to the
most recent version before reporting an issue.

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | :white_check_mark: |
| Older releases | :x:                |

## Reporting a Vulnerability

Please do **not** open a public issue, discussion or pull request for security
problems.

Report privately via GitHub:
[Report a vulnerability](https://github.com/l4rm4nd/VoucherVault/security/advisories/new)

Please include:

- Affected version or commit
- A description of the issue and its impact
- Steps to reproduce or a proof of concept (a local test instance only)
- Any suggested fix

### What to expect

- **Acknowledgement:** within 7 days
- **Assessment:** an initial verdict (accepted, declined, or more info needed)
  within 14 days
- **Updates:** at least every 14 days until resolved
- **Accepted:** a fix is developed privately and released in a new version. A
  GitHub Security Advisory (with a CVE where applicable) is published after the
  fix is available, and you are credited unless you prefer otherwise.
- **Declined:** you receive an explanation. If you disagree, you may reply with
  additional evidence.

### Scope

In scope: the VoucherVault application code, its Docker images and its default
configuration, for example authentication and authorization flaws, injection,
or exposure of voucher and user data.

Out of scope:

- Findings that need an already compromised server or admin account
- Missing hardening headers without a demonstrated impact
- Vulnerabilities in third-party dependencies with no impact on VoucherVault
  (report those upstream)
- Automated scanner output without a working proof of concept
- Denial of service through resource exhaustion on self-hosted instances
- SSRF using intended application features

### Safe harbor

Good-faith research that follows this policy, avoids privacy violations and
data destruction, and tests only against your own instance will not be pursued
legally.
