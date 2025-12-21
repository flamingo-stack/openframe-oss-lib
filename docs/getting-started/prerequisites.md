# Prerequisites

Before you begin working with the OpenFrame OSS Library, ensure your development environment meets the following requirements.

## 📋 System Requirements

| Requirement | Minimum Version | Recommended | Notes |
|-------------|-----------------|-------------|-------|
| **Java JDK** | 11+ | 17+ LTS | Required for compilation and runtime |
| **Maven** | 3.6.0+ | 3.8.0+ | For dependency management and builds |
| **IDE** | Any Java IDE | IntelliJ IDEA 2021+ | For development |
| **Memory** | 2 GB RAM | 8 GB RAM | For development environment |
| **Disk Space** | 500 MB | 1 GB+ | For dependencies and build artifacts |

## ☕ Java Development Kit

The library requires Java 11 or higher. We recommend using Java 17 LTS for the best experience.

### Installation Verification

```bash
# Check Java version
java -version

# Expected output (example):
# openjdk version "17.0.2" 2022-01-18
# OpenJDK Runtime Environment (build 17.0.2+8-Ubuntu-120.04)
# OpenJDK 64-Bit Server VM (build 17.0.2+8-Ubuntu-120.04, mixed mode, sharing)

# Check compiler version
javac -version

# Expected output (example):
# javac 17.0.2
```

### Recommended Java Distributions

- **OpenJDK** - Free and open-source
- **Oracle JDK** - Commercial support available
- **Amazon Corretto** - No-cost, multiplatform distribution
- **Eclipse Temurin** - High-quality OpenJDK builds

## 🔧 Build Tools

### Maven

Maven is used for dependency management and project building.

**Installation Check:**
```bash
mvn --version

# Expected output includes:
# Apache Maven 3.8.6
# Maven home: /usr/share/maven
# Java version: 17.0.2
```

**Alternative: Gradle**
While Maven is recommended, Gradle can also be used:
```bash
gradle --version

# Expected output includes:
# Gradle 7.4+
```

## 🛠️ Development Environment

### IDE Setup

**IntelliJ IDEA (Recommended):**
- Install Lombok plugin: `File → Settings → Plugins → Search "Lombok"`
- Enable annotation processing: `File → Settings → Build → Compiler → Annotation Processors`
- Set Project SDK to Java 11+

**Eclipse:**
- Install Lombok: Download lombok.jar and run `java -jar lombok.jar`
- Enable annotation processing in project properties

**VS Code:**
- Install "Extension Pack for Java"
- Install "Lombok Annotations Support for VS Code"

### Required IDE Plugins

| Plugin | Purpose | Installation |
|---------|---------|--------------|
| **Lombok** | Annotation processing | IDE Plugin Store |
| **Java Language Support** | Syntax highlighting | Built-in/Plugin Store |
| **Maven Integration** | Build system support | Built-in/Plugin Store |

## 📦 Dependencies

The library uses the following key dependencies (automatically managed via Maven):

```xml
<!-- Core dependencies -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.24+</version>
    <scope>provided</scope>
</dependency>
```

## 🔐 Access Requirements

### Repository Access

Ensure you have access to:
- The OpenFrame OSS Library repository
- Maven Central or your organization's artifact repository
- Any required private registries

### Permissions Checklist

- [ ] Repository clone access
- [ ] Maven repository read access
- [ ] Network access for dependency downloads
- [ ] Local development machine admin rights (for IDE setup)

## 🌍 Environment Variables

Set up the following environment variables for optimal development experience:

```bash
# Java Home (adjust path as needed)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk

# Maven Options (optional performance tuning)
export MAVEN_OPTS="-Xmx2048m -XX:MaxMetaspaceSize=512m"

# IDE Memory Settings (for IntelliJ IDEA)
export IDEA_VM_OPTIONS="-Xmx4g -XX:ReservedCodeCacheSize=512m"
```

### Environment Verification Script

Save this as `verify-setup.sh` and run it to check your environment:

```bash
#!/bin/bash
echo "🔍 Checking OpenFrame OSS Library Prerequisites..."
echo

echo "Java Version:"
java -version 2>&1 | head -1
echo

echo "Maven Version:"
mvn --version 2>&1 | head -1
echo

echo "Environment Variables:"
echo "JAVA_HOME: $JAVA_HOME"
echo "MAVEN_OPTS: $MAVEN_OPTS"
echo

echo "✅ Verification complete!"
```

## 🚨 Common Issues

### Java Version Problems

**Issue**: `UnsupportedClassVersionError`
**Solution**: Upgrade Java to version 11 or higher

**Issue**: `JAVA_HOME not set`
**Solution**: Set JAVA_HOME environment variable to JDK installation directory

### Maven Issues

**Issue**: Dependencies not downloading
**Solution**: Check internet connection and proxy settings

**Issue**: Build fails with memory errors
**Solution**: Increase MAVEN_OPTS memory settings

### Lombok Issues

**Issue**: Getters/setters not recognized in IDE
**Solution**: Install and enable Lombok plugin, restart IDE

## ✅ Prerequisites Checklist

Before proceeding to the Quick Start guide, ensure:

- [ ] Java 11+ installed and in PATH
- [ ] Maven 3.6+ installed and configured
- [ ] IDE with Lombok plugin installed
- [ ] Environment variables set
- [ ] Network access for dependency downloads
- [ ] Repository access confirmed

## 🚀 What's Next?

Once you've verified all prerequisites:

1. **[Quick Start](quick-start.md)** - Get the library running in 5 minutes
2. **[First Steps](first-steps.md)** - Explore key features and patterns

---

> **💡 Pro Tip**: Run the verification script above to quickly check if your environment is ready. If you encounter any issues, refer to the Common Issues section for solutions.