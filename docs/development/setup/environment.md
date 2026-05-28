# Development Environment Setup

This guide walks you through setting up a complete development environment for **openframe-oss-lib**.

---

## IDE Recommendations

### IntelliJ IDEA (Recommended)

IntelliJ IDEA Community or Ultimate is the recommended IDE for this project. It provides the best support for:

- Maven multi-module projects
- Spring Boot auto-configuration detection
- Lombok annotation processing
- Java 21 features (records, virtual threads, sealed classes)

**Download:** [https://www.jetbrains.com/idea/](https://www.jetbrains.com/idea/)

### VS Code (Alternative)

VS Code with the **Extension Pack for Java** is a lighter-weight alternative.

Required extensions:

- Extension Pack for Java (Microsoft)
- Spring Boot Extension Pack (VMware)
- Lombok Annotations Support

---

## IntelliJ IDEA Setup

### Step 1 — Import the Project

1. Open IntelliJ IDEA
2. Select **File → Open**
3. Navigate to the cloned `openframe-oss-lib` directory
4. Select the root `pom.xml` → click **Open as Project**
5. Wait for Maven to import all 30+ modules

### Step 2 — Configure Project SDK

1. Open **File → Project Structure → Project**
2. Set **SDK** to Java 21
3. Set **Language Level** to `21`

### Step 3 — Enable Annotation Processors (Lombok)

1. Open **Settings → Build, Execution, Deployment → Compiler → Annotation Processors**
2. Check **Enable annotation processing**
3. Select **Obtain processors from project classpath**

Without this step, Lombok-generated code will show errors.

### Step 4 — Maven Delegate (Recommended)

1. Open **Settings → Build, Execution, Deployment → Build Tools → Maven → Runner**
2. Check **Delegate IDE build/run actions to Maven**

This ensures builds use Maven directly rather than IntelliJ's internal compiler, avoiding configuration drift.

### Step 5 — Increase Memory (Optional but Recommended)

Edit `Help → Change Memory Settings` and increase to at least:

```text
Xmx: 4096 MB
```

---

## VS Code Setup

Install the Extension Pack for Java:

```bash
code --install-extension vscjava.vscode-java-pack
code --install-extension vmware.vscode-spring-boot
```

Add to `.vscode/settings.json` in your workspace:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-21",
      "path": "/path/to/jdk-21"
    }
  ],
  "java.compile.nullAnalysis.mode": "disabled",
  "maven.executable.path": "/path/to/mvn"
}
```

---

## Required Development Tools

| Tool | Installation |
|------|-------------|
| Java 21 JDK | [Adoptium Temurin 21](https://adoptium.net/) |
| Maven 3.9+ | [https://maven.apache.org/download.cgi](https://maven.apache.org/download.cgi) |
| Docker Desktop | [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) |
| Git | System package manager or [https://git-scm.com/](https://git-scm.com/) |

---

## Environment Variables for Development

Set these in your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
# Java 21 home (adjust path for your OS and distribution)
export JAVA_HOME=/path/to/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"

# Increase Maven heap for large multi-module builds
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"

# GitHub Packages credentials (required for dependency resolution)
export GITHUB_ACTOR="your-github-username"
export GITHUB_TOKEN="your-github-pat"
```

> Note: `$GITHUB_TOKEN` must have `read:packages` permission to resolve OSS library dependencies.

---

## Git Configuration

Configure your Git identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Configure line endings (important for cross-platform teams):

```bash
# macOS / Linux
git config --global core.autocrlf input

# Windows
git config --global core.autocrlf true
```

---

## Useful Maven Commands

| Command | Purpose |
|---------|---------|
| `mvn install -DskipTests` | Build all modules, skip tests |
| `mvn test -pl openframe-core` | Run unit tests for a specific module |
| `mvn verify -pl openframe-data-mongo-sync` | Run integration tests for a module |
| `mvn clean install -DskipTests` | Clean build all modules |
| `mvn dependency:tree -pl openframe-api-service-core` | View dependency tree |
| `mvn versions:display-dependency-updates` | Check for dependency updates |
| `mvn flatten:flatten` | Apply CI-friendly version flattening |

---

## Checkstyle and Code Quality (Optional)

The project uses standard Spring Boot conventions. For consistent code style:

- Java files follow standard Java conventions
- Lombok reduces boilerplate (avoid raw getters/setters when Lombok `@Data`, `@Value`, etc. apply)
- Import ordering follows IntelliJ defaults

---

## Docker Configuration

Docker is required for integration tests via Testcontainers. Ensure:

```bash
# Docker daemon is running
docker info

# Pull commonly used images in advance for faster test runs
docker pull mongo:7
docker pull nats:2
```

Testcontainers will automatically manage container lifecycle during tests.

---

## Verification

After completing setup, verify everything works:

```bash
# Full build with tests skipped
mvn install -DskipTests

# Run unit tests for core module
mvn test -pl openframe-core

# Check Java version is 21
java -version

# Check Maven version is 3.9+
mvn -version
```
