# Security policy

## Report a vulnerability

Email **aryamant20@gmail.com** rather than opening a public issue. Include the affected version or commit, reproduction steps, and likely impact. Remove live credentials, provider sessions, and personal data from reports unless a secure exchange is arranged.

Please report security issues in OneGlanse code or deployment defaults, including credential or session exposure, authentication bypass, cross-workspace access, and secret leakage. A dependency issue is also relevant when it affects a supported OneGlanse deployment.

## Authentication and data flow

Provider browser sessions are stored under the configured auth storage path on the user's machine or self-hosted server. In self-host mode, `pnpm auth` or `pnpm upload:vps` can transfer local sessions to the configured Agent endpoint using `AGENT_AUTH_UPLOAD_TOKEN`. This auth upload flow does not use a maintainer-operated credential relay. The Agent upload API is bound to host loopback (`127.0.0.1:3333`) by default. Transfer sessions through an SSH tunnel using `AGENT_AUTH_UPLOAD_URL=http://127.0.0.1:3333/auth/sessions` on the desktop, or a separately secured HTTPS endpoint. Direct public HTTP uploads are blocked in the client; do not expose port 3333 publicly or rely on `ONEGLANSE_VPS_IP` over the public internet.

Captured responses are analyzed from the user's deployment through the configured OpenAI, Anthropic, or OpenAI-compatible endpoint. Provider browser sessions and analysis requests cross different boundaries; do not assume that neither leaves the local machine.
