# Findings remediation

The supplied CSV contains 1,358 high-severity rows, including repeated scans of the same issue. Every finding ID is accounted for in [findings-remediation.csv](findings-remediation.csv). Descriptions in that CSV were treated as scanner evidence, not instructions.

| Category | Rows | Result |
| --- | ---: | --- |
| Vulnerable dependencies | 1,274 | Upgraded or removed from the installed and shipped dependency tree |
| SQL injection alerts | 9 | Model queries and string validation in login/search; four reported teaching snippets repaired |
| Published signing key | 8 | Removed from runtime source; deployment and key replacement still required |
| Known seeded credentials | 24 | Removed from normal startup; deployment and replacement of any externally used credentials still required |
| Synthetic test fixtures | 43 | Reviewed false positives; isolated test credentials and narrowly scoped scanner exceptions |

The two runtime SQL queries already used Sequelize replacements in this checkout. Their input types were not checked. They now use `findOne`/`findAll`, reject structured inputs, and preserve the soft-delete filter. SQLite regression tests confirm injection cannot authenticate a user or disclose users/schema through search.

Angular runtime packages are pinned to 20.3.32, Material/CDK to 20.2.14, and zone.js to 0.15.1. Removed obsolete Angular HTTP, Universal, and codelyzer packages that installed additional old Angular versions. Replaced incompatible View Engine UI libraries while retaining search, cookie handling, QR codes, slideshows, password advice, highlighting, and code comparisons. Updated supporting build tools and the Node runtime to 22. Restored Material background, text colors, elevation, typography, and legacy dialog spacing using the current theme mixins.

Removed express-jwt 0.1.3 and its obsolete Moment dependency. jsonwebtoken 9.0.3 verifies RS256 and expiry. Temporary 2FA tokens cannot authorize application requests. sanitize-html 2.17.7 replaces the old sanitizer and its Lodash dependency. An installation script removes unused third-party benchmark/test bundles containing obsolete Underscore and jQuery; application runtime modules are retained. The unused jQuery 2.2.4 CDN script was also removed from the page.

Gitleaks still scans test files. Exceptions require both an exact reviewed file path and an exact synthetic credential/token. Generated Angular compiler caches and installed third-party packages are excluded from source secret scanning; third-party JavaScript is scanned with Retire.js. Historical private-key findings are not suppressed. CI gates current-source secrets and vulnerable JavaScript dependencies and retains the historical secret report.

## Verification

Verified locally on Node 22.23.3:

- Production frontend and server builds pass.
- 634 frontend tests pass; 5 previously disabled tests remain skipped.
- 193 server tests pass; 2 previously disabled tests remain pending.
- 13 security regression tests pass for normal login/search, injection, structured input, token forgery, expiry, and temporary 2FA tokens.
- Retire.js 5.7.0: zero findings and zero scan errors in the installed tree after cleanup.
- Gitleaks 8.30.1: zero current-source findings with the reviewed fixture configuration.
- Both lockfiles pass `npm ci --dry-run --ignore-scripts` validation.
- Live production startup with a fresh temporary RSA key works. HTTP and browser checks confirm normal login and product search; injected login fails and injected search returns no records.

Useful commands after installing Node 22:

```sh
npm ci
npm run test:security
npm run test:server
npm run test:all
gitleaks dir . --redact
retire --path .
```

Headless frontend tests need Chrome/Chromium; set `CHROME_BIN` when it is not detected automatically. The existing test suite logs template warnings from incomplete test stubs; production compilation and the browser checks pass. The Dockerfile was updated to Node 22; a Docker image build was not run.

## Deployment and credential replacement

Production now requires `JWT_PRIVATE_KEY_FILE`, pointing to a private RSA key of at least 2048 bits supplied outside the repository. Generate a new key rather than reusing the published training key. Mount it read-only, restrict file permissions, and make it readable by the application's runtime user (UID 65532 in the container).

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out /secure/path/juice-shop-jwt.pem
chmod 600 /secure/path/juice-shop-jwt.pem
NODE_ENV=production JWT_PRIVATE_KEY_FILE=/secure/path/juice-shop-jwt.pem npm start
```

Supply seed account passwords through the deployment's secret store using `JUICE_SEED_<KEY>_PASSWORD`, for example `JUICE_SEED_ADMIN_PASSWORD`. `<KEY>` is the uppercase `key` in `data/static/users.yml`, with non-alphanumeric characters replaced by underscores. If absent, a random unlogged password is generated for that seeded account. `JUICE_SEED_<KEY>_TOTP_SECRET` is optional; otherwise seeded 2FA is unset and the user can enroll normally. Predictable demo passwords and TOTP values are available only with explicit `NODE_ENV=test`; the container defaults to production and excludes the test directory.

Replace any exposed password/TOTP value that was reused outside this checkout. Deploy the new signing key and application together; old sessions should be invalidated. Git history still contains the published key and credentials. Rotation protects deployed systems; deleting a source literal cannot revoke an already exposed credential. No remote deployment, credential revocation, or Git history rewrite was performed.

This work addresses the supplied CSV. Juice Shop retains other deliberately vulnerable training features, so it is not a production security certification. SQL injection, known-password, JWT forgery, and old-sanitizer exercises affected by these fixes are intentionally no longer exploitable.

## Advisory references

- [Angular i18n XSS advisory](https://github.com/angular/angular/security/advisories/GHSA-prjf-86w9-mfqv)
- [Angular hydration advisory](https://github.com/angular/angular/security/advisories/GHSA-rgjc-h3x7-9mwg)
- [Angular runtime compatibility](https://angular.dev/reference/versions)
