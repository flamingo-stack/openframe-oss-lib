# Development Environment Setup

This guide covers setting up a complete development environment for working with `openframe-oss-lib`.

---

## Required Tools

Install the following tools before beginning:

| Tool | Version | Installation |
|------|---------|-------------|
| **JDK 21** | 21 (LTS) | [Adoptium](https://adoptium.net/) / [SDKMAN](https://sdkman.io/) |
| **Apache Maven** | 3.8+ | [maven.apache.org](https://maven.apache.org/download.cgi) |
| **Git** | 2.x+ | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | 24+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) (for frontend-core) |

---

## Java Environment Setup

### Using SDKMAN (Recommended)

[SDKMAN](https://sdkman.io/) makes managing multiple JDK versions easy:

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 21 (Temurin)
sdk install java 21.0.4-tem

# Set as default
sdk default java 21.0.4-tem

# Verify
java -version
```

### Using System Package Manager

```bash
# macOS with Homebrew
brew install openjdk@21

# Ubuntu / Debian
sudo apt-get install openjdk-21-jdk

# Fedora / RHEL
sudo dnf install java-21-openjdk-devel
```

---

## Maven Setup

```bash
# macOS
brew install maven

# Ubuntu / Debian
sudo apt-get install maven

# Verify
mvn -version
```

### Configure GitHub Packages Access

Edit `~/.m2/settings.xml` (create it if it doesn't exist):

```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <servers>
        <server>
            <id>github</id>
            <username>YOUR_GITHUB_USERNAME</username>
            <password>YOUR_GITHUB_PERSONAL_ACCESS_TOKEN</password>
        </server>
    </servers>
</settings>
```

> Create a GitHub PAT with `read:packages` and `write:packages` scopes at [github.com/settings/tokens](https://github.com/settings/tokens).

---

## IDE Setup

### IntelliJ IDEA (Recommended)

1. **Open the project**: File → Open → select the root `pom.xml`
2. **Enable annotation processing**: Settings → Build → Compiler → Annotation Processors → ✅ Enable annotation processing
3. **Install recommended plugins**:

| Plugin | Purpose |
|--------|---------|
| **Lombok** | Required for `@Data`, `@Builder`, `@Slf4j` annotations |
| **Spring Boot** | Run configurations and property completion |
| **GraphQL** | Schema syntax highlighting |
| **Docker** | Container management |

**Recommended Settings for IntelliJ:**

```text
Settings → Build, Execution, Deployment → Build Tools → Maven
    ✓ Use plugin registry
    Maven home path: [your Maven installation]
    User settings file: ~/.m2/settings.xml

Settings → Editor → Code Style → Java
    Use project code style (if .editorconfig is present)
```

### VS Code

Install the **Extension Pack for Java**:

```bash
code --install-extension vscjava.vscode-java-pack
code --install-extension pivotal.vscode-spring-boot
```

Add to your workspace `settings.json`:

```json
{
    "java.configuration.updateBuildConfiguration": "automatic",
    "java.compile.nullAnalysis.mode": "automatic",
    "java.jdt.ls.java.home": "/path/to/java21"
}
```

---

## Docker Setup

Docker is required for integration tests (Testcontainers) and local infrastructure:

```bash
# Verify Docker is running
docker info

# Verify Docker Compose
docker compose version

# Test Testcontainers connectivity
docker pull mongo:6
docker pull redis:7
```

> On **Linux**, add your user to the `docker` group to avoid `sudo`:
> ```bash
> sudo usermod -aG docker $USER
> newgrp docker
> ```

---

## Node.js Setup (Frontend Development)

If working on the `openframe-frontend-core` module:

```bash
# Install Node.js via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify
node --version
npm --version
```

---

## Environment Variables Reference

For local development, set these shell environment variables. Add them to your `~/.zshrc`, `~/.bashrc`, or equivalent:

```bash
# OpenFrame OSS - Single tenant mode
export TENANT_ID=oss

# MongoDB
export SPRING_DATA_MONGODB_URI=mongodb://localhost:27017/openframe

# Redis
export SPRING_REDIS_HOST=localhost
export SPRING_REDIS_PORT=6379

# Kafka
export SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# NATS
export NATS_SERVER_URL=nats://localhost:4222
```

> These are only needed when running full service instances locally. Unit tests and most module tests use Testcontainers and do **not** require these.

---

## Verification Checklist

Run these commands to confirm your environment is ready:

```bash
# Java 21
java -version 2>&1 | grep "21"

# Maven 3.8+
mvn -version | grep "Apache Maven 3"

# Docker running
docker ps

# GitHub Packages accessible
mvn dependency:resolve -pl openframe-core -q && echo "Maven packages OK"
```
