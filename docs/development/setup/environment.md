# Development Environment Setup

This guide covers configuring your IDE and development tools for productive work with OpenFrame OSS Lib.

---

## IDE Recommendations

### IntelliJ IDEA (Recommended for Java)

IntelliJ IDEA (Community or Ultimate) is the recommended IDE for Java/Spring Boot development in this repository.

**Setup Steps:**

1. **Install IntelliJ IDEA** from [https://www.jetbrains.com/idea/](https://www.jetbrains.com/idea/)

2. **Open the project** — Open the root `pom.xml` as a Maven project:
   - File → Open → select `openframe-oss-lib/pom.xml`
   - Choose "Open as Project"

3. **Configure JDK 21**:
   - File → Project Structure → Project SDK → Add SDK → JDK 21

4. **Enable Annotation Processing** (required for Lombok):
   - File → Settings → Build, Execution, Deployment → Compiler → Annotation Processors
   - Check ✅ "Enable annotation processing"

5. **Install Required Plugins:**

| Plugin | Purpose |
|---|---|
| **Lombok** | Generates boilerplate from `@Data`, `@Builder`, etc. |
| **SonarLint** | Static analysis and code quality |
| **Spring** | Spring context navigation and quick fixes |
| **MapStruct Support** | Navigation for MapStruct mapper interfaces |

Install via: File → Settings → Plugins → Marketplace

---

### VS Code (Recommended for Frontend + Rust)

VS Code works well for the `openframe-frontend-core` TypeScript library and `clients/openframe-client` Rust agent.

**Recommended Extensions:**

| Extension | Purpose |
|---|---|
| `rust-analyzer` | Rust language server |
| `Even Better TOML` | Cargo.toml support |
| `ESLint` | TypeScript linting |
| `Prettier` | Code formatting |
| `Tailwind CSS IntelliSense` | CSS class autocomplete |
| `vscode-icons` | File icons for navigation |
| `GitLens` | Enhanced Git integration |

**Install all at once:**

```bash
code --install-extension rust-lang.rust-analyzer
code --install-extension tamasfe.even-better-toml
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
```

---

## Environment Variables for Development

> **IMPORTANT:** Never commit secrets or API keys to version control.

Create a local `.env` file (gitignored) or configure environment variables in your OS/IDE for local development. Common variables needed:

| Variable | Description | Example |
|---|---|---|
| `GITHUB_TOKEN` | GitHub PAT for Maven package registry | `ghp_...` |
| `GITHUB_USERNAME` | GitHub username | `your-username` |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | `local` |

For service-level config (MongoDB URI, NATS, Kafka), refer to the [openframe-oss-tenant](https://github.com/flamingo-stack/openframe-oss-tenant) configuration documentation.

---

## Maven Settings Configuration

Configure GitHub Package Registry authentication in `~/.m2/settings.xml`:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>${env.GITHUB_USERNAME}</username>
      <password>${env.GITHUB_TOKEN}</password>
    </server>
  </servers>
</settings>
```

This enables consuming published `com.openframe.oss` artifacts from GitHub Packages.

---

## Java Code Style

The project follows standard Java conventions with some OpenFrame specifics:

- **Indentation:** 4 spaces (no tabs)
- **Line length:** 120 characters max
- **Imports:** No wildcard imports
- **Annotations:** Lombok reduces boilerplate — prefer `@Data`, `@Builder`, `@RequiredArgsConstructor`

### IntelliJ Code Style Import

The Java code style is enforced via checkstyle and formatter. Import the standard Java Google Style or ask for the team's `.editorconfig` file.

```bash
cat .editorconfig
```

---

## Frontend Development Setup

For `openframe-frontend-core` development:

```bash
cd openframe-frontend-core

# Install dependencies
npm install

# Start Storybook for component development
npm run storybook

# Run unit tests
npm test

# Build the library
npm run build
```

### VS Code Workspace Settings

Create `.vscode/settings.json` in the `openframe-frontend-core` directory:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Rust Development Setup

For `clients/openframe-client`:

```bash
cd clients/openframe-client

# Check the build
cargo check

# Run tests
cargo test

# Build with debug info
cargo build

# Format code
cargo fmt

# Run linter
cargo clippy
```

### Rust Analyzer Config

Add to VS Code settings for better Rust support:

```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.features": "all"
}
```

---

## Docker Development Environment

A Docker Compose file is provided for MongoDB integration tests:

```bash
# Located at:
cat openframe-data-mongo-sync/src/test/docker/docker-compose.yml
```

Start the test infrastructure:

```bash
cd openframe-data-mongo-sync/src/test/docker
docker compose up -d
```

---

## Useful IntelliJ Live Templates

Add these custom live templates for faster development (File → Settings → Editor → Live Templates):

| Abbreviation | Expands To |
|---|---|
| `@tc` | `@TenantScoped` annotation import |
| `@restc` | Spring `@RestController` class skeleton |
| `@dgs` | Netflix DGS `@DgsComponent` + `@DgsQuery` skeleton |

---

## Summary

| Tool | Setup | Priority |
|---|---|---|
| IntelliJ IDEA + Lombok plugin | Required for Java modules | High |
| JDK 21 | Required for all Java modules | High |
| Maven `settings.xml` | Required for artifact publishing | High |
| VS Code + rust-analyzer | Required for Rust agent work | Medium |
| VS Code + ESLint/Prettier | Recommended for frontend | Medium |
| Docker | Required for integration tests | High |
