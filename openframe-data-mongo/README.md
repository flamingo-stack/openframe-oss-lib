# openframe-data-mongo

MongoDB documents and Spring Data repositories for the OpenFrame multi-tenant platform, extracted from the authorization
server for reuse.

Contents:

- `document/` domain documents (Mongo) used by multi-tenant auth
- `repository/` Spring Data repositories for the documents

Scope:

- Pure model and repository interfaces, no service/business logic
- No environment-specific configuration

Publishing:

- Configured to publish to GitHub Packages via Actions on tag `v*.*.*`

