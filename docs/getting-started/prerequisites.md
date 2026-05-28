# Prerequisites

Before working with OpenFrame OSS Lib, ensure your development environment meets these requirements.

## Required Software

| Software | Minimum Version | Recommended Version | Purpose |
|----------|----------------|-------------------|---------|
| **Java JDK** | 8+ | 17+ (LTS) | Core development platform |
| **Maven** | 3.6+ | 3.9+ | Build and dependency management |
| **Git** | 2.20+ | Latest | Version control |
| **IDE** | Any Java IDE | IntelliJ IDEA or Eclipse | Development environment |

## Java Development Kit (JDK)

### Installation

**Using SDKMAN (Recommended):**
```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 17 (LTS)
sdk install java 17.0.9-oracle
sdk use java 17.0.9-oracle
```

**Manual Installation:**
- Oracle JDK: [Download from Oracle](https://www.oracle.com/java/technologies/downloads/)
- OpenJDK: [Download from OpenJDK](https://openjdk.org/install/)

### Verification

```bash
# Check Java version
java -version

# Check Java compiler
javac -version

# Verify JAVA_HOME
echo $JAVA_HOME
```

Expected output:
```text
java version "17.0.9" 2023-10-17 LTS
Java(TM) SE Runtime Environment (build 17.0.9+11-LTS-201)
Java HotSpot(TM) 64-Bit Server VM (build 17.0.9+11-LTS-201, mixed mode, sharing)
```

## Apache Maven

### Installation

**Using Package Managers:**

```bash
# macOS with Homebrew
brew install maven

# Ubuntu/Debian
sudo apt update
sudo apt install maven

# RHEL/CentOS/Fedora
sudo yum install maven
# or
sudo dnf install maven

# Windows with Chocolatey
choco install maven
```

**Manual Installation:**
1. Download from [Apache Maven](https://maven.apache.org/download.cgi)
2. Extract to your preferred location
3. Add `bin` directory to your `$PATH`
4. Set `$M2_HOME` environment variable

### Verification

```bash
# Check Maven version
mvn -version

# Verify Maven home
echo $M2_HOME
```

Expected output:
```text
Apache Maven 3.9.5 (57804ffe001d7215b5e7bcb531cf83df38f93546)
Maven home: /usr/local/Cellar/maven/3.9.5/libexec
Java version: 17.0.9, vendor: Oracle Corporation
```

## Git Version Control

### Installation

```bash
# macOS
brew install git

# Ubuntu/Debian  
sudo apt install git

# RHEL/CentOS/Fedora
sudo yum install git
```

### Configuration

```bash
# Set your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify configuration
git config --list
```

## IDE Setup

### IntelliJ IDEA (Recommended)

1. **Download**: [JetBrains IntelliJ IDEA](https://www.jetbrains.com/idea/download/)
2. **Required Plugins**:
   - Lombok Plugin (for annotation processing)
   - Maven Helper
   - Git Integration (built-in)

### Eclipse IDE

1. **Download**: [Eclipse IDE for Java Developers](https://www.eclipse.org/downloads/packages/)
2. **Required Plugins**:
   - Lombok Support
   - M2Eclipse (Maven integration)

### VS Code

If you prefer VS Code:
```bash
# Install extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension gabrielbb.vscode-lombok
```

## Environment Variables

Set these environment variables for optimal development:

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)

# Java Home (adjust path for your installation)
export JAVA_HOME=/path/to/your/java/installation

# Maven Home (if manually installed)
export M2_HOME=/path/to/your/maven/installation

# Add to PATH
export PATH=$JAVA_HOME/bin:$M2_HOME/bin:$PATH

# Maven options
export MAVEN_OPTS="-Xmx1024m -XX:MaxMetaspaceSize=256m"
```

**Windows Users:**
Set environment variables through System Properties > Advanced > Environment Variables

## Account Requirements

### GitHub Access

You'll need GitHub access to:
- Clone the OpenFrame OSS Lib repository
- Submit pull requests and contributions
- Access dependency repositories

```bash
# Test GitHub SSH access
ssh -T git@github.com

# Or configure HTTPS authentication
git config --global credential.helper store
```

### Flamingo Community

Join the OpenMSP community for support:
- **Slack Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Platform Access**: [OpenFrame](https://openframe.ai)

## System Requirements

### Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 4 GB | 8+ GB |
| **CPU** | 2 cores | 4+ cores |
| **Disk Space** | 2 GB free | 5+ GB free |
| **Network** | Broadband internet | Stable connection |

### Operating System

Supported platforms:
- **Linux**: Ubuntu 18.04+, CentOS 7+, RHEL 8+
- **macOS**: 10.14+ (Mojave or later)
- **Windows**: Windows 10, Windows 11

## Lombok Configuration

OpenFrame OSS Lib uses Lombok extensively. Configure your IDE:

### IntelliJ IDEA

1. Install Lombok plugin: `File > Settings > Plugins > Search "Lombok"`
2. Enable annotation processing: `File > Settings > Build > Compiler > Annotation Processors`
3. Check "Enable annotation processing"

### Eclipse

1. Download lombok.jar from [Project Lombok](https://projectlombok.org/download)
2. Run: `java -jar lombok.jar`
3. Follow installation wizard to patch Eclipse

### VS Code

The Java extension pack includes Lombok support automatically.

## Verification Checklist

Before proceeding, verify you can:

- [ ] Compile Java code with JDK 8+
- [ ] Run Maven commands (`mvn --version`)
- [ ] Clone Git repositories
- [ ] Access your preferred IDE with Java support
- [ ] Connect to GitHub
- [ ] Set environment variables (`$JAVA_HOME`, `$PATH`)

## Troubleshooting

### Common Issues

**`JAVA_HOME` not set:**
```bash
# Find Java installation
sudo find /usr -name "java" -type f 2>/dev/null
# Set JAVA_HOME to the JDK directory (not the bin directory)
export JAVA_HOME=/path/to/jdk
```

**Maven permission denied (Linux/macOS):**
```bash
# Make Maven executable
chmod +x /path/to/maven/bin/mvn
```

**IDE not recognizing Lombok:**
- Ensure Lombok plugin is installed and enabled
- Restart IDE after installation
- Check annotation processing is enabled

## Next Steps

Once your environment is configured:

1. [**Quick Start**](quick-start.md) - Clone and build the library in 5 minutes
2. [**First Steps**](first-steps.md) - Explore the core DTOs and patterns

## Need Help?

- **GitHub Issues**: Report technical problems
- **OpenMSP Slack**: [Join the community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) for support
- **Documentation**: Review the [architecture documentation](../reference/architecture/README.md)