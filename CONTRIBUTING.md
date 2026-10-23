# Contributing to Agora

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Getting started

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env` and add the API keys you have. You only need keys for the providers you use.
3. Start the backend and frontend as described in the [README](README.md).

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pyflakes
python run.py
```

```bash
cd frontend && npm install && npm run dev
```

## Before you open a pull request

Run the checks:

```bash
cd backend && python -m pyflakes app run.py
cd frontend && npm run build
```

Then check these project conventions:

- **No code comments or docstrings.** Names and structure should explain the code.
- **No hard-coded colors in components.** Every color is a token in `frontend/src/theme/theme.css`. Use the Tailwind theme classes or CSS variables. The palette is Blueberry and Cream Soda plus the agent tints.
- **No secrets in the repo.** Keys go in `.env` only.
- **Validate model output** with the Pydantic schemas in `backend/app/schemas/llm.py`. Do not trust raw model text.
- **Log with structured fields,** not free-form strings, and include the debate id.
- **Keep the UI accessible.** Text must meet WCAG AA contrast. Do not use color alone to show status, identity or penalties. Add an icon or label.
- Keep pull requests focused. One change per pull request is easier to review.

## Reporting bugs

Open an issue using the bug template. Include what you expected, what happened, the provider and model involved, and the relevant lines from `backend/logs/agora-errors.log` with any keys removed.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
