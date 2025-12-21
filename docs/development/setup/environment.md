# Development Environment Setup

This guide will help you set up a complete development environment for contributing to the OpenFrame OSS Library. We'll cover IDE configuration, development tools, and productivity enhancements.

## 🎯 Setup Overview

Your development environment should include:
- Java Development Kit (JDK 17+)
- Modern IDE with Lombok support
- Build tools (Maven)
- Code quality tools
- Version control integration

## ☕ Java Development Kit

### Required Version
- **Minimum**: Java 11
- **Recommended**: Java 17 LTS or Java 21 LTS
- **Purpose**: Compilation and runtime support

### Installation Options

#### Option 1: OpenJDK (Recommended)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

**macOS (Homebrew):**
```bash
brew install openjdk@17
sudo ln -sfn $(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
```

**Windows (Chocolatey):**
```powershell
choco install openjdk17
```

#### Option 2: Oracle JDK

Download from [Oracle's website](https://www.oracle.com/java/technologies/downloads/) and follow platform-specific instructions.

#### Option 3: SDKMAN (Cross-platform)

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash

# Install Java
sdk install java 17.0.7-tem
sdk use java 17.0.7-tem
```

### Verification

```bash
# Check installation
java --version
javac --version

# Expected output (example):
# openjdk 17.0.7 2023-04-18
# OpenJDK Runtime Environment (build 17.0.7+7-Ubuntu-0ubuntu120.04.2)
# OpenJDK 64-Bit Server VM (build 17.0.7+7-Ubuntu-0ubuntu120.04.2, mixed mode, sharing)
```

## 🛠️ IDE Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides excellent Java and Lombok support out of the box.

#### Installation

**Option 1: JetBrains Toolbox (Recommended)**
1. Download JetBrains Toolbox
2. Install IntelliJ IDEA Community (free) or Ultimate

**Option 2: Direct Download**
- Download from [JetBrains website](https://www.jetbrains.com/idea/)
- Choose Community Edition (sufficient for OSS development)

#### Essential Configuration

1. **Install Lombok Plugin**
   ```
   File → Settings → Plugins → Search "Lombok" → Install
   ```

2. **Enable Annotation Processing**
   ```
   File → Settings → Build, Execution, Deployment → Compiler → Annotation Processors
   ✅ Enable annotation processing
   ```

3. **Configure Java SDK**
   ```
   File → Project Structure → Project Settings → Project
   Project SDK: 17 (or your installed version)
   Project language level: 17 - Sealed types, always-strict floating-point semantics
   ```

4. **Code Style Settings**
   ```
   File → Settings → Editor → Code Style → Java
   - Tabs and Indents: Use 4 spaces
   - Wrapping and Braces: Keep simple methods in one line: OFF
   - Imports: Class count to use import with '*': 999
   ```

#### Useful IntelliJ Plugins

| Plugin | Purpose | Installation |
|--------|---------|--------------|
| **Lombok** | Annotation processing support | Required |
| **Maven Helper** | Enhanced Maven integration | Recommended |
| **SonarLint** | Code quality analysis | Recommended |
| **GitToolBox** | Enhanced Git integration | Optional |
| **String Manipulation** | Text processing utilities | Optional |

### Eclipse Setup

If you prefer Eclipse, here's how to configure it:

#### Installation & Configuration

1. **Download Eclipse IDE for Java Developers**
   - From [Eclipse website](https://www.eclipse.org/downloads/)
   - Choose "Eclipse IDE for Java Developers"

2. **Install Lombok**
   ```bash
   # Download lombok.jar from https://projectlombok.org/download
   java -jar lombok.jar
   
   # Follow the installer to add Lombok to Eclipse
   # Restart Eclipse after installation
   ```

3. **Configure Workspace**
   ```
   Window → Preferences → Java → Compiler
   - Compiler compliance level: 17
   
   Window → Preferences → Java → Code Style → Formatter
   - Import OpenFrame code style (if available)
   ```

### Visual Studio Code

For a lightweight alternative:

#### Required Extensions

```bash
# Install VS Code extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension GabrielBB.vscode-lombok
code --install-extension redhat.java
```

#### Configuration (settings.json)

```json
{
    "java.configuration.updateBuildConfiguration": "automatic",
    "java.compile.nullAnalysis.mode": "automatic",
    "java.format.settings.url": "https://raw.githubusercontent.com/google/styleguide/gh-pages/eclipse-java-google-style.xml",
    "maven.executable.path": "/usr/bin/mvn"
}
```

## 📦 Build Tools

### Apache Maven

Maven is the primary build tool for the OpenFrame OSS Library.

#### Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install maven
```

**macOS:**
```bash
brew install maven
```

**Windows:**
```powershell
choco install maven
```

#### Configuration

Create/update `~/.m2/settings.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <profiles>
        <profile>
            <id>default</id>
            <properties>
                <maven.compiler.source>17</maven.compiler.source>
                <maven.compiler.target>17</maven.compiler.target>
                <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            </properties>
        </profile>
    </profiles>
    
    <activeProfiles>
        <activeProfile>default</activeProfile>
    </activeProfiles>
</settings>
```

#### Verification

```bash
mvn --version

# Expected output:
# Apache Maven 3.8.6
# Maven home: /usr/share/maven
# Java version: 17.0.7, vendor: Eclipse Adoptium
```

## 🔧 Development Tools

### Code Quality Tools

#### Checkstyle

Add to your Maven `pom.xml`:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-checkstyle-plugin</artifactId>
    <version>3.1.2</version>
    <configuration>
        <configLocation>checkstyle.xml</configLocation>
        <encoding>UTF-8</encoding>
        <consoleOutput>true</consoleOutput>
        <failsOnError>true</failsOnError>
    </configuration>
    <executions>
        <execution>
            <id>validate</id>
            <phase>validate</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

#### SpotBugs

```xml
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>4.7.3.0</version>
    <configuration>
        <effort>Max</effort>
        <threshold>Low</threshold>
        <xmlOutput>true</xmlOutput>
    </configuration>
</plugin>
```

### Git Configuration

Set up Git for OpenFrame development:

```bash
# Configure user information
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Set up useful aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status

# Configure line ending handling
git config --global core.autocrlf input  # Mac/Linux
git config --global core.autocrlf true   # Windows
```

## 🚀 Productivity Enhancements

### Environment Variables

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH

# Maven
export MAVEN_OPTS="-Xmx2048m -XX:MaxMetaspaceSize=512m"

# Development
export OPENFRAME_DEV_MODE=true
export OPENFRAME_LOG_LEVEL=DEBUG
```

### IDE Live Templates

#### IntelliJ IDEA Templates

Create custom live templates for common patterns:

**Template: `ofevent`** - Create LogEvent
```java
LogEvent.builder()
    .toolEventId("$ID$")
    .eventType("$TYPE$")
    .severity("$SEVERITY$")
    .timestamp(Instant.now())
    .build()
```

**Template: `offilter`** - Create DeviceFilters
```java
DeviceFilters.builder()
    .statuses(Arrays.asList("$STATUS$"))
    .deviceTypes(Arrays.asList("$TYPES$"))
    .build()
```

### Shell Aliases

Add useful development aliases:

```bash
# Maven shortcuts
alias mci='mvn clean install'
alias mct='mvn clean test'
alias mcc='mvn clean compile'
alias mcp='mvn clean package'

# OpenFrame specific
alias ofbuild='mvn clean install -DskipTests'
alias oftest='mvn test'
alias offormat='mvn fmt:format'
```

## ✅ Environment Verification

Use this script to verify your setup:

```bash
#!/bin/bash
echo "🔍 OpenFrame OSS Library Development Environment Check"
echo "================================================="

# Java check
echo "Java Version:"
java --version 2>&1 | head -1
echo

# Maven check  
echo "Maven Version:"
mvn --version 2>&1 | head -1
echo

# Git check
echo "Git Version:"
git --version
echo

# IDE check (IntelliJ)
if command -v idea &> /dev/null; then
    echo "✅ IntelliJ IDEA CLI available"
else
    echo "⚠️  IntelliJ IDEA CLI not found"
fi

echo
echo "Environment Variables:"
echo "JAVA_HOME: $JAVA_HOME"
echo "MAVEN_OPTS: $MAVEN_OPTS"

echo
echo "✅ Verification complete!"
```

## 🐛 Troubleshooting

### Common Issues

<details>
<summary><strong>Java version conflicts</strong></summary>

**Problem**: Multiple Java versions installed
**Solution**: 
```bash
# List installed versions
update-alternatives --list java

# Set default version
sudo update-alternatives --config java
```
</details>

<details>
<summary><strong>Lombok not working in IDE</strong></summary>

**Problem**: IDE doesn't recognize Lombok annotations
**Solution**:
1. Ensure Lombok plugin is installed
2. Enable annotation processing
3. Restart IDE
4. Rebuild project
</details>

<details>
<summary><strong>Maven proxy issues</strong></summary>

**Problem**: Cannot download dependencies
**Solution**: Configure proxy in `~/.m2/settings.xml`
```xml
<proxies>
    <proxy>
        <id>default</id>
        <active>true</active>
        <protocol>http</protocol>
        <host>proxy.company.com</host>
        <port>8080</port>
    </proxy>
</proxies>
```
</details>

## 🎯 Next Steps

With your environment set up:

1. **[Local Development Setup](local-development.md)** - Clone and build the project
2. **[Architecture Overview](../architecture/overview.md)** - Understand the codebase
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Learn development standards

---

> **🎉 Environment Ready!** You now have a fully configured development environment for contributing to the OpenFrame OSS Library. The next step is to clone the repository and start building!