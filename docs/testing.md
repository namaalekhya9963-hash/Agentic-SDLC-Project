# Testing

## Run the Artifact Suite

```powershell
npm.cmd test
```

The suite verifies:

- Required lifecycle documents exist.
- Requirements reference Jira KAN-2.
- PR description contains all required sections.
- Repository text contains no common MCP credential or OAuth secret patterns.
