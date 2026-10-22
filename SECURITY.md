# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private security advisories). Include what you found, the steps to reproduce it, and the impact you see. You can expect an acknowledgement within a few days and a fix or a clear plan after that.

## Supported versions

Only the latest commit on the default branch receives security fixes.

## Things to know when running Agora

- **Agora has no login.** Anyone who can reach the API can start debates, which spend your API credits, and can read and delete saved debates. Run it on `localhost` or behind your own authentication, a VPN or a private network. Do not expose it to the open internet as is.
- **API keys live in `.env`.** Never commit that file. It is listed in `.gitignore`. If a key is ever pushed or pasted somewhere public, revoke it at the provider and create a new one.
- **Keys stay on the server.** The browser never sees them. The backend returns only the names of missing variables, never their values.
- **Saved debates are plain files** in `backend/data/debates/` (or the `agora-data` Docker volume). Protect that location if your questions are sensitive.
- **Docker.** The compose file publishes the backend on `127.0.0.1` only and the web UI on port 8080. Change the port mapping deliberately if you want other machines to reach it.
- **CORS.** Set `CORS_ORIGINS` to the exact origins that should call the API when you serve the UI from a different host.

## Scope

In scope: the Agora backend and frontend in this repository.
Out of scope: vulnerabilities in third-party model providers, Tavily, or upstream libraries. Report those to their maintainers.
