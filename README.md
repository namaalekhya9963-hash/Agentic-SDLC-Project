# Agentic SDLC Automated Documentation Sync

This repository implements the GitHub Copilot Agentic SDLC capstone workflow for Jira issue [KAN-2](https://namaalekhya9963.atlassian.net/browse/KAN-2).

## Lifecycle Documents

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Design Review](docs/design-review.md)
- [Implementation Plan](docs/impl-plan.md)
- [Code Review](docs/code-review.md)
- [Verification](docs/verification.md)
- [Pull Request Description](docs/pr-description.md)

## Verification

```powershell
npm.cmd test
```

GitHub Actions runs the same test suite for pushes and pull requests through `.github/workflows/ci.yml`.
