# Prerequisites

Before you can start using the OpenFrame OSS Library, ensure your development environment meets the following requirements.

## System Requirements

### Java Development Kit (JDK)

| Component | Minimum Version | Recommended Version | Notes |
|-----------|----------------|-------------------|--------|
| **Java JDK** | 8 | 11 or 17 LTS | Required for compilation and runtime |
| **Maven** | 3.6.0 | 3.8.0+ | For dependency management and builds |
| **Gradle** | 6.0 | 7.0+ | Alternative build tool (optional) |

### Operating System Support

| OS | Supported Versions |
|----|-------------------|
| **Windows** | Windows 10, Windows 11, Windows Server 2019+ |
| **macOS** | 10.15 (Catalina) and later |
| **Linux** | Ubuntu 18.04+, CentOS 7+, RHEL 7+, Debian 9+ |

### Development Environment

| Tool | Purpose | Recommended |
|------|---------|-------------|
| **IDE** | Java development | IntelliJ IDEA, Eclipse, VS Code |
| **Git** | Version control | 2.20+ |
| **Lombok Plugin** | Annotation processing | Latest version for your IDE |

## Required Dependencies

The OpenFrame OSS Library uses the following key dependencies:

```xml
<!-- Core Dependencies -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.24+</version>
</dependency>

<!-- Optional: For JSON serialization -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-annotations</artifactId>
    <version>2.13.0+</version>
</dependency>
```

## Environment Variables

While not required for basic usage, you may need these environment variables for development:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `JAVA_HOME` | JDK installation path | `/usr/lib/jvm/java-11-openjdk` |
| `M2_HOME` | Maven installation path | `/opt/maven` |
| `PATH` | Include Java and Maven bins | `$JAVA_HOME/bin:$M2_HOME/bin:$PATH` |

## Account & Access Requirements

### Repository Access

- **Public Repository**: No special access required for open-source usage
- **Private Dependencies**: Contact OpenFrame for enterprise library access
- **CI/CD Integration**: Repository credentials for automated builds

### OpenFrame Platform Access (Optional)

If you're integrating with OpenFrame services:

| Access Level | Requirements |
|-------------|-------------|
| **Developer** | OpenFrame developer account |
| **Integration** | API keys and service endpoints |
| **Production** | Production environment credentials |

## Verification Commands

Run these commands to verify your environment is ready:

### 1. Verify Java Installation

```bash
java -version
```

**Expected output:**
```text
openjdk version "11.0.16" 2022-07-19
OpenJDK Runtime Environment (build 11.0.16+8-post-Ubuntu-0ubuntu120.04)
OpenJDK 64-Bit Server VM (build 11.0.16+8-post-Ubuntu-0ubuntu120.04, mixed mode, sharing)
```

### 2. Verify Maven Installation

```bash
mvn -version
```

**Expected output:**
```text
Apache Maven 3.8.6 (84538c9988a25aec085021c365c560670ad80f63)
Maven home: /opt/maven
Java version: 11.0.16, vendor: Eclipse Adoptium, runtime: /usr/lib/jvm/java-11-openjdk
```

### 3. Verify Git Installation

```bash
git --version
```

**Expected output:**
```text
git version 2.34.1
```

### 4. Test Basic Project Creation

Create a test Maven project to verify your setup:

```bash
mvn archetype:generate \
  -DgroupId=com.example.test \
  -DartifactId=openframe-test \
  -DarchetypeArtifactId=maven-archetype-quickstart \
  -DinteractiveMode=false

cd openframe-test
mvn compile
```

**Expected output:**
```text
[INFO] BUILD SUCCESS
[INFO] Total time: 2.345 s
```

## IDE Configuration

### IntelliJ IDEA

1. **Install Lombok Plugin**:
   - Go to `File` > `Settings` > `Plugins`
   - Search for "Lombok" and install
   - Restart IDE

2. **Enable Annotation Processing**:
   - Go to `File` > `Settings` > `Build, Execution, Deployment` > `Compiler` > `Annotation Processors`
   - Check "Enable annotation processing"

### Eclipse

1. **Install Lombok**:
   - Download lombok.jar from [projectlombok.org](https://projectlombok.org/)
   - Run: `java -jar lombok.jar`
   - Follow installation wizard

2. **Restart Eclipse** after installation

### VS Code

1. **Install Extensions**:
   - Extension Pack for Java
   - Lombok Annotations Support for VS Code

## Common Setup Issues

### Issue: "lombok not found" compilation errors

**Solution:**
```bash
# Verify Lombok is in dependencies
mvn dependency:tree | grep lombok

# Ensure annotation processing is enabled in IDE
# Restart IDE after enabling Lombok plugin
```

### Issue: Java version compatibility

**Solution:**
```bash
# Check Java version
java -version
javac -version

# Set JAVA_HOME if needed
export JAVA_HOME=/path/to/java11
export PATH=$JAVA_HOME/bin:$PATH
```

### Issue: Maven dependency resolution

**Solution:**
```bash
# Clear local repository cache
rm -rf ~/.m2/repository/com/openframe

# Force update dependencies
mvn clean compile -U
```

## Next Steps

Once your environment is verified and ready:

1. ✅ **Prerequisites Complete** - You're ready to proceed!
2. 🚀 **[Quick Start](quick-start.md)** - Get the library running in 5 minutes
3. 🎯 **[First Steps](first-steps.md)** - Explore core features and patterns

> **Troubleshooting**: If you encounter setup issues, check our [development setup guide](../development/setup/environment.md) for detailed configuration instructions.