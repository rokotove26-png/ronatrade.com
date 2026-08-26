# RONA System Admin workspace plugin

Version 1.0.1 is a thin workspace wrapper around the existing published ChatGPT app `RONA System Admin`.

The plugin declares the canonical registered app in `.app.json`. The app itself owns the authenticated RONA Trade `SYSTEM_ADMIN` MCP connection, OAuth, fixed-role enforcement, and audited access. No credentials, tokens, passwords, or API keys are stored in this plugin package.
