# Development Environment Setup

This guide walks you through setting up a complete development environment for working on `openframe-oss-lib`.

---

## IDE Recommendations

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best developer experience for this Spring Boot multi-module project.

**Setup steps:**

1. **Install IntelliJ IDEA** — Community Edition is sufficient; Ultimate adds Spring Boot tooling.
2. **Open the project** — Select `File → Open` and choose the root `pom.xml`.
3. **Enable annotation processing** — Required for Lombok:
   - Go to `Settings → Build, Execution, Deployment → Compiler → Annotation Processors`
   - Check **Enable annotation processing**
4. **Set Project SDK to Java 21**:
   - `File → Project Structure → Project SDK → Java 21`
5. **Install the Lombok plugin** (usually pre-installed in recent versions):
   - `Settings → Plugins → Search "Lombok" → Install`

**Recommended IntelliJ plugins:**

| Plugin | Purpose |
|--------|---------|
| Lombok | Reduces boilerplate code annotation support |
| Spring Boot | Run configurations, Spring-aware navigation |
| MongoDB | Database introspection and query editing |
| GraphQL | Schema-aware editing for `.graphqls` files |
| Docker | Docker Compose integration |
| SonarLint | Real-time code quality analysis |

---

### VS Code

VS Code is a viable alternative with the right extensions.

**Required extensions:**

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| Extension Pack for Java | Microsoft | Full Java language support |
| Spring Boot Extension Pack | VMware/Pivotal | Spring Boot tooling |
| Lombok Annotations Support | GabrielBB | Lombok support |
| Docker | Microsoft | Docker Compose integration |
| GraphQL: Language Feature Support | GraphQL Foundation | GraphQL schema editing |

**Setup steps:**

```bash
# Install Java extensions from command line
code --install-extension vscjava.vscode-java-pack
code --install-extension vmware.vscode-spring-boot
code --install-extension GabrielBB.vscode-lombok
```

---

## Required Development Tools

### Java 21

```bash
# Using SDKMAN (recommended for version management)
sdk install java 21.0.3-tem

# Or using Homebrew on macOS
brew install --cask temurin@21

# Verify
java -version
```

### Apache Maven 3.9+

```bash
# Using SDKMAN
sdk install maven 3.9.9

# Or using Homebrew on macOS
brew install maven

# Verify
mvn -version
```

### Docker & Docker Compose

```bash
# Install Docker Desktop (macOS/Windows)
# https://www.docker.com/products/docker-desktop/

# Verify
docker --version
docker compose version
```

---

## Environment Variables for Development

Create a `.env` file or configure your shell profile with development defaults:

```bash
# Core tenant configuration (OSS single-tenant mode)
export TENANT_ID=oss

# MongoDB connection
export SPRING_DATA_MONGODB_URI=mongodb://localhost:27017/openframe

# Redis
export SPRING_REDIS_HOST=localhost
export SPRING_REDIS_PORT=6379

# NATS
export NATS_SERVER=nats://localhost:4222

# Kafka
export SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# JWT config (for local dev, keys are generated from a dev keystore)
# In production, these are managed by your secrets provider
export jwt__issuer=http://localhost:8080/oss
```

> **Tip:** Use [direnv](https://direnv.net/) to automatically load `.env` files per project directory.

---

## Maven Settings

To resolve dependencies from GitHub Packages, configure `~/.m2/settings.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_PAT_WITH_READ_PACKAGES</password>
    </server>
  </servers>
</settings>
```

---

## Code Style Configuration

The project follows standard Java conventions aligned with Spring Boot coding style. Configure your IDE with:

### IntelliJ Code Style

1. Import the Google Java Format or use the default IntelliJ style
2. Enable **"Reformat code on save"**: `Settings → Tools → Actions on Save → Reformat code`
3. Enable **"Organize imports on save"**

### EditorConfig

If an `.editorconfig` file is present in the repository root, your IDE will automatically use it for consistent formatting.

---

## Git Configuration

Ensure your Git author information is set correctly before committing:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Optional: set default branch name to main
git config --global init.defaultBranch main
```

### Recommended Git Aliases

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --decorate --all"
```

---

## Verifying Your Setup

Run this checklist to confirm everything is ready:

```bash
# 1. Java 21
java -version

# 2. Maven
mvn -version

# 3. Docker
docker info

# 4. Clone and compile
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
mvn compile -DskipTests

# 5. Run unit tests for core module
mvn test -pl openframe-core
```

All commands should complete without errors.

---

## Troubleshooting Common Issues

| Issue | Solution |
|-------|---------|
| `Could not resolve dependencies` | Verify GitHub Packages credentials in `~/.m2/settings.xml` |
| `Lombok annotations not processed` | Enable annotation processing in IDE settings |
| `Java version mismatch` | Set project SDK to Java 21 in IDE project settings |
| `Docker not running` | Start Docker Desktop and run `docker info` to verify |
| `Port already in use` | Stop conflicting services or change ports in `application.yml` |
