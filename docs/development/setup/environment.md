# Development Environment Setup

This guide will help you set up a complete development environment for contributing to the OpenFrame OSS Library. Follow these steps to ensure your environment is properly configured for Java development with the specific tools and plugins required for this project.

## System Requirements

### Operating System Support

| Operating System | Minimum Version | Recommended Version | Notes |
|------------------|----------------|-------------------|--------|
| **Windows** | Windows 10 | Windows 11 | WSL2 recommended for better compatibility |
| **macOS** | 10.15 (Catalina) | 12.0+ (Monterey) | Intel and Apple Silicon supported |
| **Linux** | Ubuntu 18.04 LTS | Ubuntu 22.04 LTS | Other distributions supported |

### Hardware Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space for development tools
- **CPU**: Multi-core processor recommended for faster builds

## Core Development Tools

### 1. Java Development Kit (JDK)

#### Installation Options

**Option A: OpenJDK (Recommended)**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-11-jdk

# macOS (using Homebrew)
brew install openjdk@11

# Windows (using Chocolatey)
choco install openjdk11
```

**Option B: Oracle JDK**
Download from [Oracle's website](https://www.oracle.com/java/technologies/downloads/) and follow installation instructions.

**Option C: SDKMAN (Cross-platform)**
```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java
sdk install java 11.0.16-tem
sdk use java 11.0.16-tem
```

#### Verification
```bash
java -version
javac -version
```

Expected output:
```text
openjdk version "11.0.16" 2022-07-19
OpenJDK Runtime Environment (build 11.0.16+8-post-Ubuntu-0ubuntu120.04)
```

### 2. Build Tools

#### Maven Installation

**Linux/macOS:**
```bash
# Using package manager
sudo apt install maven  # Ubuntu/Debian
brew install maven       # macOS

# Manual installation
wget https://dlcdn.apache.org/maven/maven-3/3.8.6/binaries/apache-maven-3.8.6-bin.tar.gz
tar xzf apache-maven-3.8.6-bin.tar.gz
sudo mv apache-maven-3.8.6 /opt/maven
```

**Windows:**
```powershell
# Using Chocolatey
choco install maven

# Using Scoop
scoop install maven
```

**Environment Configuration:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export M2_HOME=/opt/maven
export MAVEN_HOME=/opt/maven
export PATH=$M2_HOME/bin:$PATH
```

**Verification:**
```bash
mvn -version
```

#### Gradle Installation (Alternative)

```bash
# Using SDKMAN
sdk install gradle

# Using package managers
brew install gradle     # macOS
choco install gradle    # Windows
```

### 3. Git Configuration

#### Installation
```bash
# Ubuntu/Debian
sudo apt install git

# macOS
brew install git

# Windows
choco install git
```

#### Configuration
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
```

#### SSH Key Setup
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key (add to GitHub/GitLab)
cat ~/.ssh/id_ed25519.pub
```

## IDE Setup and Configuration

### IntelliJ IDEA (Recommended)

#### Installation
```bash
# Using JetBrains Toolbox (Recommended)
# Download from: https://www.jetbrains.com/toolbox-app/

# Using package managers
brew install --cask intellij-idea    # macOS
choco install intellij-idea-community # Windows (Community)
snap install intellij-idea-community  # Linux
```

#### Essential Plugins
1. **Lombok Plugin**:
   - Go to `File` → `Settings` → `Plugins`
   - Search and install "Lombok"
   - Restart IDE

2. **Maven Integration** (Usually pre-installed)
3. **Git Integration** (Usually pre-installed)

#### IDE Configuration

**Enable Annotation Processing:**
1. Go to `File` → `Settings` → `Build, Execution, Deployment` → `Compiler` → `Annotation Processors`
2. Check "Enable annotation processing"
3. Set "Processor path" to "Use processor path from module"

**Code Style Setup:**
1. Go to `File` → `Settings` → `Editor` → `Code Style` → `Java`
2. Set tab size to 4 spaces
3. Enable "Use tab character" = false
4. Set continuation indent to 8

**Import Settings:**
```xml
<!-- Save as .editorconfig in project root -->
root = true

[*.java]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### Eclipse Configuration

#### Installation
```bash
# Download from: https://www.eclipse.org/downloads/
# Or using package managers
brew install --cask eclipse-java    # macOS
choco install eclipse               # Windows
snap install eclipse --classic     # Linux
```

#### Lombok Setup
1. Download lombok.jar from [projectlombok.org](https://projectlombok.org/)
2. Run: `java -jar lombok.jar`
3. Select Eclipse installation directory
4. Click "Install/Update"
5. Restart Eclipse

#### Workspace Configuration
1. **Java Build Path**: Set compliance level to 11
2. **Code Style**: Import formatting rules
3. **Save Actions**: Enable organize imports, format code

### VS Code Configuration

#### Installation
```bash
# Download from: https://code.visualstudio.com/
# Or using package managers
brew install --cask visual-studio-code  # macOS
choco install vscode                     # Windows
snap install code --classic             # Linux
```

#### Essential Extensions
```json
{
  "recommendations": [
    "vscjava.vscode-java-pack",
    "gabrielbb.vscode-lombok",
    "redhat.java",
    "vscjava.vscode-maven",
    "ms-vscode.vscode-json"
  ]
}
```

**Install Extensions:**
```bash
code --install-extension vscjava.vscode-java-pack
code --install-extension gabrielbb.vscode-lombok
```

## Environment Variables

### Required Variables

**Linux/macOS (.bashrc/.zshrc):**
```bash
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk
export M2_HOME=/opt/maven
export MAVEN_HOME=$M2_HOME
export PATH=$JAVA_HOME/bin:$M2_HOME/bin:$PATH
```

**Windows (System Properties):**
```text
JAVA_HOME=C:\Program Files\Java\jdk-11
M2_HOME=C:\apache-maven-3.8.6
PATH=%JAVA_HOME%\bin;%M2_HOME%\bin;%PATH%
```

### Verification Script

Create a verification script to check your environment:

**Linux/macOS (verify-env.sh):**
```bash
#!/bin/bash

echo "=== Development Environment Verification ==="
echo

echo "Java Version:"
java -version
echo

echo "Maven Version:"
mvn -version
echo

echo "Git Version:"
git --version
echo

echo "Environment Variables:"
echo "JAVA_HOME: $JAVA_HOME"
echo "M2_HOME: $M2_HOME"
echo

echo "Java Compiler:"
which javac
echo

echo "Maven Executable:"
which mvn
```

**Run verification:**
```bash
chmod +x verify-env.sh
./verify-env.sh
```

## Additional Development Tools

### Code Quality Tools

#### Checkstyle
```xml
<!-- Add to pom.xml -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-checkstyle-plugin</artifactId>
    <version>3.2.0</version>
    <configuration>
        <configLocation>checkstyle.xml</configLocation>
        <encoding>UTF-8</encoding>
        <consoleOutput>true</consoleOutput>
    </configuration>
</plugin>
```

#### SpotBugs
```xml
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>4.7.2.1</version>
</plugin>
```

### Development Utilities

#### cURL (for API testing)
```bash
# Ubuntu/Debian
sudo apt install curl

# macOS
brew install curl

# Windows
choco install curl
```

#### jq (JSON processing)
```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq

# Windows
choco install jq
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "JAVA_HOME not set" error
**Solution:**
```bash
# Check current JAVA_HOME
echo $JAVA_HOME

# Find Java installation
sudo find / -name "java" -type f 2>/dev/null | grep bin

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk
```

#### Issue: Maven dependency resolution failures
**Solution:**
```bash
# Clear local repository
rm -rf ~/.m2/repository

# Force update dependencies
mvn clean compile -U
```

#### Issue: Lombok not working in IDE
**Solution:**

**IntelliJ IDEA:**
1. Install Lombok plugin
2. Enable annotation processing in settings
3. Restart IDE

**Eclipse:**
```bash
java -jar lombok.jar
# Follow installation wizard
```

#### Issue: Git authentication failures
**Solution:**
```bash
# Use SSH instead of HTTPS
git remote set-url origin git@github.com:username/repo.git

# Or configure credential helper
git config --global credential.helper cache
```

#### Issue: Build performance on Windows
**Solution:**
```bash
# Enable Maven parallel builds
mvn -T 1C clean compile

# Use Windows Subsystem for Linux (WSL2)
wsl --install
```

## Performance Optimization

### IDE Performance Tuning

**IntelliJ IDEA (idea.vmoptions):**
```text
-Xms2g
-Xmx8g
-XX:ReservedCodeCacheSize=1024m
-XX:+UseConcMarkSweepGC
-XX:SoftRefLRUPolicyMSPerMB=50
```

**Maven Performance (.mvn/maven.config):**
```text
-Dmaven.artifact.threads=8
-T 1C
```

### Build Optimization

**Parallel Compilation:**
```bash
# Use multiple threads
mvn -T 4 clean compile

# Skip tests during development
mvn compile -DskipTests=true
```

## Next Steps

Once your environment is set up:

1. ✅ **Verify all tools** are working correctly
2. 🔄 **[Set up local development](local-development.md)** - Clone and build the project
3. 🧪 **[Run tests](../testing/overview.md)** - Ensure everything works
4. 📖 **[Read architecture docs](../architecture/overview.md)** - Understand the codebase

---

**Environment Ready?** Continue with [Local Development Setup](local-development.md) to get the OpenFrame OSS Library running on your machine.