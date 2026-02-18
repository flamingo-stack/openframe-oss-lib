# Prerequisites

Before diving into OpenFrame OSS Lib development, ensure your system meets the following requirements.

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|----------------|-------------|-------|
| **Java** | 21 | 21+ | OpenJDK or Oracle JDK |
| **Maven** | 3.8.0 | 3.9+ | Build tool |
| **Memory** | 8GB RAM | 16GB+ | For development with all services |
| **Storage** | 10GB free | 20GB+ | Includes dependencies and databases |
| **OS** | Any Java-supported | Linux/macOS | Windows supported via WSL |

## Required Software

### 1. Java Development Kit (JDK) 21

OpenFrame OSS Lib requires Java 21 as specified in the parent POM.

**Install OpenJDK 21:**

```bash
# macOS (using Homebrew)
brew install openjdk@21

# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# CentOS/RHEL
sudo dnf install java-21-openjdk-devel

# Windows
# Download from https://adoptium.net/temurin/releases/
```

**Verify installation:**

```bash
java -version
# Should show: openjdk version "21.x.x"
```

### 2. Apache Maven 3.8+

The project uses Maven for dependency management and builds.

**Install Maven:**

```bash
# macOS (using Homebrew) 
brew install maven

# Ubuntu/Debian
sudo apt install maven

# CentOS/RHEL
sudo dnf install maven

# Windows (using Chocolatey)
choco install maven
```

**Verify installation:**

```bash
mvn --version
# Should show Maven 3.8+ and Java 21
```

### 3. Git

Required for cloning the repository and version control.

```bash
# Verify Git is installed
git --version
```

## Development Environment Setup

### IDE Recommendations

**IntelliJ IDEA (Recommended)**
- Ultimate or Community Edition
- Spring Boot plugin (bundled)
- Lombok plugin (bundled in newer versions)
- GraphQL plugin for DGS support

**Eclipse**  
- Spring Tools 4 (STS4)
- Lombok plugin
- M2E Maven integration

**VS Code**
- Extension Pack for Java
- Spring Boot Extension Pack
- Lombok Annotations Support

### Environment Variables

Set the following environment variables for development:

```bash
# Java 21 (if multiple versions installed)
export JAVA_HOME=/path/to/jdk-21

# Maven heap size for large builds
export MAVEN_OPTS="-Xmx2048m -XX:MaxPermSize=256m"

# Optional: Maven local repository location  
export M2_HOME=/path/to/maven
```

**For Windows:**

```cmd
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.x.x
set MAVEN_OPTS=-Xmx2048m
```

## Optional Dependencies

While not strictly required for building the core libraries, these services enhance the development experience:

### Database Services (for integration testing)

**MongoDB** - Primary data store
```bash
# Docker (recommended for development)
docker run -d --name mongodb -p 27017:27017 mongo:7

# macOS
brew install mongodb-community

# Ubuntu/Debian
sudo apt install mongodb-org
```

**Redis** - Caching layer
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:7

# macOS  
brew install redis

# Ubuntu/Debian
sudo apt install redis-server
```

### Messaging & Streaming (for full platform testing)

**Apache Kafka** - Event streaming
```bash
# Docker Compose (recommended)
# Creates Kafka + Zookeeper
docker-compose up kafka zookeeper
```

**NATS** - Client messaging
```bash
# Docker
docker run -d --name nats -p 4222:4222 nats:latest

# Binary install
# Download from https://nats.io/download/
```

## Verification Checklist

Run these commands to verify your development environment:

```bash
# 1. Java version
java -version
# ✅ Should show Java 21

# 2. Maven version  
mvn --version
# ✅ Should show Maven 3.8+ with Java 21

# 3. Git access
git --version
# ✅ Should show Git version

# 4. Memory check
free -h  # Linux/macOS
# ✅ Should show 8GB+ available RAM

# 5. Disk space
df -h
# ✅ Should show 10GB+ free space
```

## Network & Access Requirements

### GitHub Access

Ensure you can access the repository:

```bash
# Test GitHub connectivity
curl -I https://github.com

# Clone test (if you have access)
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
```

### Maven Dependencies

The project uses GitHub Packages for artifact distribution. No special configuration is needed for public access, but verify your network allows Maven Central and GitHub Packages:

```bash
# Test Maven Central access
curl -I https://repo1.maven.org/maven2/

# Test GitHub Packages access  
curl -I https://maven.pkg.github.com/
```

## IDE-Specific Configuration

### IntelliJ IDEA

1. **Project Import**:
   - File → Open → Select root `pom.xml`
   - Import as Maven project
   - Enable auto-import for Maven changes

2. **Lombok Setup**:
   - Install Lombok plugin (if not bundled)
   - Enable annotation processing: Settings → Build → Compiler → Annotation Processors

3. **Code Style**:
   - Import Spring Java code style (optional)
   - Configure line length to 120 characters

### Eclipse/STS

1. **Project Import**:
   - File → Import → Existing Maven Projects
   - Select root directory

2. **Lombok Setup**:
   - Download lombok.jar from projectlombok.org
   - Run: `java -jar lombok.jar`
   - Install in Eclipse installation

## Next Steps

With your environment set up, you're ready to:

1. **[Quick Start](quick-start.md)** - Build and run the project
2. **[First Steps](first-steps.md)** - Explore the architecture
3. **[Development Guide](../development/setup/local-development.md)** - Dive deeper into development

## Troubleshooting

**Common Issues:**

- **OutOfMemoryError during build**: Increase `MAVEN_OPTS="-Xmx4096m"`
- **Java version conflicts**: Ensure `JAVA_HOME` points to JDK 21
- **Lombok not working**: Install IDE plugin and enable annotation processing
- **Maven download failures**: Check network connectivity and proxy settings

For more help, join our [OpenMSP Community Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA).