# Prerequisites

Before you can start developing with the OpenFrame OSS Library, ensure your development environment meets the following requirements. This guide will help you verify and install everything needed for a smooth development experience.

## 📋 System Requirements

### Required Software

| Software | Minimum Version | Recommended Version | Purpose |
|----------|----------------|-------------------|---------|
| **Java JDK** | 17+ | 21 LTS | Core runtime and compilation |
| **Maven** | 3.8.0+ | 3.9.6+ | Dependency management and build |
| **Git** | 2.30+ | Latest | Version control |
| **IDE** | Any Java IDE | IntelliJ IDEA 2023.3+ | Development environment |

### Development Database (Optional)
| Software | Version | Purpose |
|----------|---------|---------|
| **MongoDB** | 6.0+ | Local development database |
| **Docker** | 20.10+ | Containerized development |

## ☕ Java Development Kit (JDK)

### Installation

**Option 1: Using SDKMAN (Recommended)**
```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source ~/.bashrc

# Install latest JDK
sdk install java 21.0.1-amzn
sdk use java 21.0.1-amzn
```

**Option 2: Direct Download**
- Download from [Amazon Corretto](https://aws.amazon.com/corretto/) or [OpenJDK](https://openjdk.org/)
- Follow platform-specific installation instructions

### Verification
```bash
java --version
# Expected output: openjdk 21.0.1 or later

javac --version  
# Expected output: javac 21.0.1 or later

echo $JAVA_HOME
# Should point to your JDK installation
```

## 🔧 Maven Build Tool

### Installation

**Option 1: Using Package Manager**
```bash
# macOS with Homebrew
brew install maven

# Ubuntu/Debian
sudo apt update && sudo apt install maven

# Windows with Chocolatey
choco install maven
```

**Option 2: Manual Installation**
1. Download from [Apache Maven](https://maven.apache.org/download.cgi)
2. Extract and add `bin` directory to your `PATH`
3. Set `M2_HOME` environment variable

### Verification
```bash
mvn --version
# Expected output: Apache Maven 3.8+ with your Java version
```

## 🛠️ Development Environment Setup

### Environment Variables

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Java
export JAVA_HOME="/path/to/your/jdk"
export PATH="$JAVA_HOME/bin:$PATH"

# Maven  
export M2_HOME="/path/to/maven"
export PATH="$M2_HOME/bin:$PATH"

# OpenFrame Development (Optional)
export OPENFRAME_ENV="development"
export MONGODB_URL="mongodb://localhost:27017/openframe-dev"
```

### IDE Configuration

**IntelliJ IDEA (Recommended)**
1. Install the latest version from [JetBrains](https://www.jetbrains.com/idea/)
2. Configure JDK: File → Project Structure → Project SDK → Add JDK
3. Enable annotation processing: Build → Compiler → Annotation Processors
4. Install useful plugins:
   - Lombok Plugin
   - MongoDB Plugin
   - Docker Plugin

**VS Code**
1. Install [Extension Pack for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack)
2. Configure Java home in settings

**Eclipse**
1. Download [Eclipse IDE for Enterprise Java Developers](https://www.eclipse.org/downloads/)
2. Install Lombok: Download lombok.jar and run `java -jar lombok.jar`

## 🗄️ Optional: Local Development Database

### MongoDB (For Full Development)

**Option 1: Docker (Recommended)**
```bash
# Run MongoDB in a container
docker run --name openframe-mongo \
  -p 27017:27017 \
  -d mongo:7

# Verify connection
docker exec -it openframe-mongo mongosh
```

**Option 2: Local Installation**
```bash
# macOS with Homebrew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Ubuntu
sudo apt install -y mongodb
sudo systemctl start mongodb
```

### Verification
```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017
# Should connect successfully
```

## 🐳 Docker (Optional but Recommended)

Docker simplifies development with containerized services and consistent environments.

### Installation
- **Windows/macOS**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Follow [official installation guide](https://docs.docker.com/engine/install/)

### Verification
```bash
docker --version
# Expected: Docker version 20.10+

docker-compose --version  
# Expected: Docker Compose version 2.0+
```

## ✅ Verification Checklist

Run these commands to verify your complete setup:

<details>
<summary><strong>Click to expand verification script</strong></summary>

```bash
#!/bin/bash
echo "=== OpenFrame OSS Library Prerequisites Check ==="
echo

# Java
echo "🔍 Checking Java..."
if command -v java &> /dev/null; then
    java --version | head -1
    echo "✅ Java installed"
else
    echo "❌ Java not found"
fi
echo

# Maven
echo "🔍 Checking Maven..."
if command -v mvn &> /dev/null; then
    mvn --version | head -1
    echo "✅ Maven installed"
else
    echo "❌ Maven not found"
fi
echo

# Git
echo "🔍 Checking Git..."
if command -v git &> /dev/null; then
    git --version
    echo "✅ Git installed"
else
    echo "❌ Git not found"
fi
echo

# Environment Variables
echo "🔍 Checking Environment Variables..."
echo "JAVA_HOME: ${JAVA_HOME:-'Not set'}"
echo "M2_HOME: ${M2_HOME:-'Not set'}"
echo

# Optional: MongoDB
echo "🔍 Checking MongoDB (Optional)..."
if command -v mongosh &> /dev/null; then
    mongosh --version | head -1
    echo "✅ MongoDB client installed"
elif command -v mongo &> /dev/null; then
    mongo --version | head -1  
    echo "✅ MongoDB client installed"
else
    echo "ℹ️  MongoDB not installed (optional for development)"
fi
echo

# Optional: Docker
echo "🔍 Checking Docker (Optional)..."
if command -v docker &> /dev/null; then
    docker --version
    echo "✅ Docker installed"
else
    echo "ℹ️  Docker not installed (optional but recommended)"
fi

echo
echo "=== Setup Complete! ==="
echo "Ready to proceed with the Quick Start guide."
```

</details>

## 🚨 Troubleshooting

### Common Issues

**Java Version Conflicts**
```bash
# Check all installed Java versions
/usr/libexec/java_home -V  # macOS
update-alternatives --display java  # Linux

# Set specific version
export JAVA_HOME=$(/usr/libexec/java_home -v 21)  # macOS
sudo update-alternatives --config java  # Linux
```

**Maven Build Failures**
```bash
# Clear Maven cache
rm -rf ~/.m2/repository

# Verify Maven settings
mvn help:effective-settings

# Check proxy settings if behind corporate firewall
cat ~/.m2/settings.xml
```

**Permission Issues (Linux/macOS)**
```bash
# Fix Maven permissions
sudo chown -R $(whoami) ~/.m2

# Fix Java permissions  
sudo chown -R $(whoami) $JAVA_HOME
```

## 📱 Platform-Specific Notes

### Windows
- Use PowerShell or Windows Terminal for better experience
- Consider WSL2 for Linux-like development environment
- Set environment variables via System Properties → Advanced → Environment Variables

### macOS
- Use Homebrew for package management
- Consider using iTerm2 for better terminal experience
- Set environment variables in `~/.zshrc` or `~/.bash_profile`

### Linux
- Package managers vary by distribution (apt, yum, pacman)
- Environment variables typically go in `~/.bashrc`
- Check firewall settings if having connection issues

## 🎯 What's Next?

Once you've completed this prerequisites checklist:

1. **✅ All requirements met?** → Continue to [Quick Start](quick-start.md)
2. **❌ Missing something?** → Address the gaps and return here
3. **🤔 Need help?** → Join our [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

---

**Great job setting up your development environment!** You're now ready to get OpenFrame OSS Library up and running.