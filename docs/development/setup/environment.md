# Development Environment Setup

This guide will help you set up a productive development environment for OpenFrame OSS Lib, optimized for Java development with Lombok, Maven, and modern IDE features.

## IDE Recommendations

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best experience for OpenFrame OSS Lib development.

#### Installation

```bash
# macOS with Homebrew
brew install --cask intellij-idea

# Ubuntu/Debian with Snap
sudo snap install intellij-idea-community --classic

# Windows with Chocolatey  
choco install intellij-idea-community
```

#### Required Plugins

Install these essential plugins:

1. **Lombok Plugin**
   - `File > Settings > Plugins > Marketplace`
   - Search "Lombok" and install
   - Restart IntelliJ IDEA

2. **Maven Helper**
   - Dependency analysis and conflict resolution
   - Right-click POM files for enhanced features

3. **SonarLint** (Optional but recommended)
   - Code quality analysis
   - Real-time feedback on code issues

#### Configuration

**Enable Annotation Processing:**
```text
File > Settings > Build, Execution, Deployment > Compiler > Annotation Processors
☑️ Enable annotation processing
☑️ Obtain processors from project classpath
```

**Configure Code Style:**
```bash
# Import OpenFrame code style (if available)
File > Settings > Editor > Code Style > Java > Import Scheme
# Or configure manually:
# - Indent: 4 spaces
# - Line length: 120 characters  
# - Import order: java.*, javax.*, org.*, com.*
```

**Set up Auto Import:**
```text
File > Settings > Editor > General > Auto Import
☑️ Add unambiguous imports on the fly
☑️ Optimize imports on the fly
```

### Eclipse IDE

Eclipse is well-supported for OpenFrame OSS Lib development.

#### Installation

```bash
# Download Eclipse IDE for Java Developers
# https://www.eclipse.org/downloads/packages/

# Ubuntu/Debian
sudo apt install eclipse

# macOS with Homebrew
brew install --cask eclipse-java
```

#### Lombok Setup

Eclipse requires manual Lombok installation:

```bash
# Download lombok.jar
wget https://projectlombok.org/downloads/lombok.jar

# Run installer
java -jar lombok.jar
# Follow GUI installer to patch Eclipse

# Or manual installation:
# 1. Copy lombok.jar to your Eclipse directory
# 2. Edit eclipse.ini and add: -javaagent:lombok.jar
```

#### Required Plugins

1. **M2Eclipse** (Usually pre-installed)
   - Maven integration for Eclipse
   - `Help > Eclipse Marketplace > Search "Maven"`

2. **EGit** (Usually pre-installed)  
   - Git integration
   - Native Eclipse Git support

#### Configuration

**Configure Maven:**
```text
Window > Preferences > Maven
☑️ Download Artifact Sources
☑️ Download Artifact JavaDoc
```

**Set up Code Formatting:**
```text
Window > Preferences > Java > Code Style > Formatter
# Import formatter profile or configure:
# - Tab policy: Spaces only
# - Indentation size: 4
# - Maximum line width: 120
```

### VS Code (Lightweight Option)

For a lightweight development experience:

#### Installation & Extensions

```bash
# Install VS Code
# https://code.visualstudio.com/download

# Install Java extension pack
code --install-extension vscjava.vscode-java-pack

# Additional helpful extensions  
code --install-extension gabrielbb.vscode-lombok
code --install-extension redhat.java
code --install-extension vscjava.vscode-maven
```

#### Configuration

Create `.vscode/settings.json`:
```json
{
    "java.configuration.updateBuildConfiguration": "automatic",
    "java.compile.nullAnalysis.mode": "automatic",
    "java.format.settings.url": "./eclipse-formatter.xml",
    "maven.executable.path": "/usr/local/bin/mvn",
    "lombok.jar.path": "~/.m2/repository/org/projectlombok/lombok/1.18.28/lombok-1.18.28.jar"
}
```

## Required Development Tools

### Maven Configuration

#### Global Settings

Create `~/.m2/settings.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
    
    <profiles>
        <profile>
            <id>openframe-dev</id>
            <properties>
                <maven.compiler.source>11</maven.compiler.source>
                <maven.compiler.target>11</maven.compiler.target>
                <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            </properties>
        </profile>
    </profiles>
    
    <activeProfiles>
        <activeProfile>openframe-dev</activeProfile>
    </activeProfiles>
</settings>
```

#### Maven Wrapper

Use the Maven wrapper for consistent builds:
```bash
# Generate wrapper (if not present)
mvn -N io.takari:maven:wrapper

# Use wrapper instead of global Maven
./mvnw clean compile
./mvnw test
./mvnw install
```

### Git Configuration

#### Global Git Setup

```bash
# Set your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Set default branch name
git config --global init.defaultBranch main

# Enable helpful settings
git config --global core.autocrlf input
git config --global core.safecrlf true
git config --global pull.rebase false
```

#### OpenFrame-Specific Git Hooks

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Pre-commit hook for code quality

echo "Running pre-commit checks..."

# Check code formatting
if ! ./mvnw spotless:check > /dev/null 2>&1; then
    echo "❌ Code formatting issues detected. Run: ./mvnw spotless:apply"
    exit 1
fi

# Run tests
if ! ./mvnw test > /dev/null 2>&1; then
    echo "❌ Tests failed. Fix failing tests before committing."
    exit 1
fi

echo "✅ Pre-commit checks passed!"
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Environment Variables

### Required Environment Variables

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Java Development
export JAVA_HOME="/path/to/java/installation"
export MAVEN_HOME="/path/to/maven/installation"
export PATH="$JAVA_HOME/bin:$MAVEN_HOME/bin:$PATH"

# Maven optimization
export MAVEN_OPTS="-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+TieredCompilation"

# OpenFrame Development
export OPENFRAME_DEV_MODE=true
export OPENFRAME_LOG_LEVEL=DEBUG

# IDE-specific (optional)
export IDEA_JDK="$JAVA_HOME"
export ECLIPSE_HOME="/path/to/eclipse"
```

### Windows Environment Variables

Set via System Properties > Advanced > Environment Variables:

```text
JAVA_HOME = C:\Program Files\Java\jdk-17
MAVEN_HOME = C:\apache-maven-3.9.5
PATH = %JAVA_HOME%\bin;%MAVEN_HOME%\bin;%PATH%
MAVEN_OPTS = -Xmx2048m -XX:MaxMetaspaceSize=512m
```

## Development Dependencies

### Core Dependencies

Your development environment should have access to these:

```xml
<!-- In your IDE's classpath or global Maven repository -->
<dependencies>
    <!-- Lombok for annotation processing -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.28</version>
        <scope>provided</scope>
    </dependency>
    
    <!-- Jackson for JSON processing -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>2.15.2</version>
    </dependency>
    
    <!-- JUnit for testing -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.10.0</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Optional Development Tools

```bash
# Code quality and formatting
brew install spotless  # or equivalent for your OS

# API testing
brew install httpie    # HTTP client
brew install postman   # GUI API testing

# Database tools (if working with persistence layers)
brew install dbeaver   # Database IDE
```

## Editor Extensions and Plugins

### IntelliJ IDEA Productivity Plugins

1. **Rainbow Brackets** - Visual bracket matching
2. **GitToolBox** - Enhanced Git integration
3. **Maven Helper** - Dependency analysis
4. **CheckStyle-IDEA** - Code style validation
5. **Swagger** - API documentation support

### VS Code Java Extensions

```bash
# Essential Java development
code --install-extension vscjava.vscode-java-pack

# Code quality
code --install-extension sonarsource.sonarlint-vscode
code --install-extension esbenp.prettier-vscode

# Git integration  
code --install-extension eamodio.gitlens
code --install-extension mhutchie.git-graph

# API development
code --install-extension 42Crunch.vscode-openapi
code --install-extension humao.rest-client
```

## Database Tools (Optional)

If you're working on integration testing with databases:

### DBeaver (Universal Database Tool)

```bash
# Installation
brew install --cask dbeaver-community  # macOS
sudo snap install dbeaver-ce           # Ubuntu
choco install dbeaver                   # Windows
```

### H2 Database (For Testing)

```xml
<!-- Add to test dependencies -->
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <version>2.1.214</version>
    <scope>test</scope>
</dependency>
```

## Performance Optimization

### JVM Tuning for Development

Add to your IDE's JVM options:

**IntelliJ IDEA:**
```text
# idea.vmoptions or idea64.vmoptions
-Xmx4096m
-XX:+UseG1GC
-XX:+UseCompressedOops
-Dfile.encoding=UTF-8
```

**Eclipse:**
```text
# eclipse.ini
-vmargs
-Xmx2048m
-XX:+UseG1GC
-XX:MaxMetaspaceSize=512m
```

### Maven Performance

```bash
# Use parallel builds
alias mvnp='mvn -T 1C'  # 1 thread per CPU core

# Skip tests during development iterations
alias mvnf='mvn clean compile -DskipTests'

# Quick install to local repository
alias mvni='mvn install -DskipTests'
```

## Verification Checklist

Verify your environment is properly configured:

```bash
# Java and build tools
java -version                    # Should show Java 8+
mvn --version                    # Should show Maven 3.6+
git --version                    # Should show Git 2.20+

# Environment variables
echo $JAVA_HOME                  # Should point to JDK
echo $MAVEN_HOME                 # Should point to Maven (if manually installed)

# IDE verification
# Open the OpenFrame OSS Lib project
# Lombok annotations should not show errors
# Maven dependencies should resolve
# Tests should run and pass
```

## Troubleshooting

### Common Environment Issues

**Lombok not working in IDE:**
```bash
# Verify Lombok plugin installed and annotation processing enabled
# For Eclipse, ensure lombok.jar is in Eclipse directory
# For IntelliJ, check File > Settings > Annotation Processors
```

**Maven dependencies not resolving:**
```bash
# Clear Maven cache
rm -rf ~/.m2/repository/com/openframe
mvn clean compile

# Force update
mvn clean compile -U
```

**IDE performance issues:**
```bash
# Increase IDE memory allocation
# IntelliJ: idea.vmoptions
# Eclipse: eclipse.ini
# VS Code: increase Node.js memory limit
```

### Getting Help

- **IDE Issues**: Check IDE-specific documentation and community forums
- **Maven Problems**: Visit [Maven Troubleshooting Guide](https://maven.apache.org/guides/mini/guide-ide-eclipse.html)
- **Lombok Issues**: See [Project Lombok Setup](https://projectlombok.org/setup/overview)
- **OpenFrame Questions**: Join [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

## Next Steps

With your environment configured:

1. [**Local Development Guide**](local-development.md) - Clone, build, and run the project
2. [**Architecture Overview**](../architecture/README.md) - Understand the codebase structure  
3. [**Contributing Guidelines**](../contributing/guidelines.md) - Learn the development workflow

---

*A well-configured development environment is the foundation for productive OpenFrame OSS Lib development. Take time to set up these tools properly - it will save hours later.*