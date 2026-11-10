# Security Policy

## Supported Versions

Only the latest state of the `main` branch is supported with security updates.

| Version | Supported |
| --- | --- |
| `main` | Yes |

## Scope

Mona Patrol is a client-side static HTML/CSS/JavaScript canvas game with no
backend, user accounts, or external runtime network requests. Security issues of
interest include:

- Cross-site scripting (XSS) or Content-Security-Policy bypasses
- Unsafe cross-window or iframe escape behavior when embedded in GitHub Arcade
- Vulnerable development or CI workflow configurations

## Reporting a Vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue:

1. Use [GitHub Private Vulnerability Reporting](https://github.com/jdooley-clt/mona-patrol/security/advisories/new)
   on this repository.
2. Include steps to reproduce, browser/OS details, and potential impact.

Reports are reviewed promptly and a fix will be prepared before disclosure.
