---
name: test-verification
description: Run automated test suites, verify acceptance criteria, check edge cases, and generate a verification report.
---

# Test Verification Skill

1. Review `requirements.md` and the test files in `tests/`.
2. Identify the test runner configured in `package.json` (`node --test`).
3. Execute the test suite and capture pass/fail results.
4. Verify that all functional and security acceptance criteria are covered by tests.
5. Check for missing edge-case or negative test scenarios (such as invalid inputs or failed authentication).
6. Document any failing tests, uncovered requirements, or environment issues.
7. Prepare `verification.md` with test execution results and coverage status.
8. Wait for human approval.
