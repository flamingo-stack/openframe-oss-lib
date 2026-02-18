# Development Environment Setup

This guide helps you configure a complete development environment for OpenFrame OSS Lib, including IDE setup, development tools, and productivity enhancements.

## IDE Setup & Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best experience for Spring Boot development with OpenFrame OSS Lib.

#### Installation & Basic Setup

**1. Install IntelliJ IDEA**
- Download [IntelliJ IDEA Ultimate](https://www.jetbrains.com/idea/) (recommended) or Community Edition
- Ultimate includes advanced Spring Boot support, database tools, and HTTP client

**2. Import the Project**
```bash
# Clone and open in IntelliJ
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
# File → Open → Select openframe-oss-lib/pom.xml
# Choose "Open as Project"
```

**3. Enable Required Plugins**
Go to File → Settings → Plugins and ensure these are installed:
- ✅ **Lombok** - For annotation processing (bundled in newer versions)
- ✅ **Spring Boot** - For configuration support (bundled)
- ✅ **GraphQL** - For DGS schema support
- ✅ **Database Tools** - For MongoDB/Redis inspection (Ultimate)

#### IntelliJ Configuration

**Java Settings**
```text
File → Project Structure → Project:
- Project SDK: Java 21
- Language Level: 21 - Records, patterns, local enums

File → Project Structure → Modules:
- Ensure all modules use Java 21
```

**Maven Configuration**
```text
File → Settings → Build → Build Tools → Maven:
- Maven home path: [your maven installation]
- User settings file: default or custom
- JVM options: -Xmx2048m -XX:ReservedCodeCacheSize=512m
```

**Lombok Setup**
```text
File → Settings → Build → Compiler → Annotation Processors:
☑ Enable annotation processing
☑ Obtain processors from project classpath
```

**Code Style**
```text
File → Settings → Editor → Code Style → Java:
- Scheme: Default or create "OpenFrame"
- Tabs and Indents: 4 spaces, continuation indent 8
- Wrapping: Right margin at 120 characters
```

#### Productivity Enhancements

**Run Configurations**
Create run configurations for common tasks:

```text
Run → Edit Configurations → Add New → Maven
Name: Build All Modules
Command line: clean install
Working directory: $PROJECT_DIR$
```

**Live Templates**
Add custom templates for OpenFrame patterns:
```text
File → Settings → Editor → Live Templates → Java:

Template: ofservice
Abbreviation: ofservice  
Template text:
@Service
@RequiredArgsConstructor
@Slf4j
public class $CLASS_NAME$ {
    
    $END$
    
}
```

### Eclipse/Spring Tool Suite (STS)

If you prefer Eclipse, STS provides excellent Spring Boot support.

#### Installation
```bash
# Download Spring Tool Suite
# https://spring.io/tools

# Or install Eclipse with Spring plugins
# Help → Eclipse Marketplace → Search "Spring Tools"
```

#### Eclipse Configuration  

**Lombok Installation**
```bash
# Download lombok.jar from https://projectlombok.org/download
java -jar lombok.jar
# Follow installer to add to Eclipse
```

**Maven Integration**
```text
Window → Preferences → Maven:
☑ Download Artifact Sources
☑ Download Artifact JavaDoc
User Settings: [path to settings.xml if custom]
```

**Code Formatting**
```text
Window → Preferences → Java → Code Style → Formatter:
Import Spring Java conventions or create custom profile
Line wrapping: 120 characters
```

### VS Code

For lightweight development or remote work, VS Code works well with proper extensions.

#### Required Extensions
```json
{
  "recommendations": [
    "vscjava.vscode-java-pack",
    "vmware.vscode-spring-boot",
    "redhat.java",
    "vscjava.vscode-lombok",
    "ms-java.vscode-java-debug"
  ]
}
```

#### VS Code Configuration
```json
// .vscode/settings.json
{
  "java.home": "/path/to/jdk-21",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-21", 
      "path": "/path/to/jdk-21"
    }
  ],
  "java.compile.nullAnalysis.mode": "automatic",
  "maven.terminal.useJavaHome": true
}
```

## Environment Variables

Set these environment variables for consistent development:

### Global Environment Variables

```bash
# ~/.bashrc or ~/.zshrc

# Java 21 Configuration
export JAVA_HOME=/path/to/jdk-21
export PATH=$JAVA_HOME/bin:$PATH

# Maven Configuration  
export MAVEN_HOME=/path/to/maven
export MAVEN_OPTS="-Xmx4096m -XX:ReservedCodeCacheSize=512m"

# OpenFrame Development
export OPENFRAME_DEV_MODE=true
export OPENFRAME_LOG_LEVEL=DEBUG
```

### Development-Specific Variables

Create a `.env` file in your project root:

```bash
# OpenFrame Development Environment

# Database URLs (for local development)
MONGODB_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379

# Security Settings
JWT_SECRET_KEY=your-development-secret-key-here
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret

# External Service URLs
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
NATS_URL=nats://localhost:4222

# Feature Flags
FEATURE_SSO_ENABLED=true
FEATURE_ANALYTICS_ENABLED=false
```

## Development Tools

### Database Management

**MongoDB**
```bash
# Install MongoDB Compass for GUI management
# https://www.mongodb.com/products/compass

# Or use command line tools
brew install mongodb/brew/mongodb-database-tools
```

**Redis**  
```bash
# Install Redis CLI tools
brew install redis

# Or use RedisInsight for GUI
# https://redis.com/redis-enterprise/redis-insight/
```

**Database Docker Setup**
```bash
# Create docker-compose.dev.yml for local databases
docker-compose -f docker-compose.dev.yml up -d
```

### API Development & Testing

**HTTP Client Setup**

IntelliJ IDEA has a built-in HTTP client:
```text
Tools → HTTP Client → Create Request in HTTP Client
```

Example requests file (`requests.http`):
```http
### Test Authentication
POST http://localhost:8080/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=test&client_secret=test

### Test Device API  
GET http://localhost:8080/api/devices
Authorization: Bearer {{auth_token}}
```

**Postman Collection**
Create a Postman collection with:
- Authentication requests
- CRUD operations for each domain
- Environment variables for different deployment targets

### Code Quality Tools

**SonarLint Integration**
```text
IDE Plugin: SonarLint
- Real-time code quality feedback
- Security vulnerability detection  
- Code smell identification
```

**Checkstyle Configuration**
```xml
<!-- checkstyle.xml - place in project root -->
<?xml version="1.0"?>
<!DOCTYPE module PUBLIC
    "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
    "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
    <module name="TreeWalker">
        <module name="LineLength">
            <property name="max" value="120"/>
        </module>
    </module>
</module>
```

## Development Productivity

### Git Configuration

```bash
# Configure Git for OpenFrame development
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"

# Useful aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status

# Better diff and merge tools
git config --global merge.tool intellij
git config --global diff.tool intellij
```

### Maven Productivity

**Maven Wrapper Configuration**
```bash
# Use Maven Wrapper for consistent builds
./mvnw clean install

# Skip tests during development
./mvnw clean install -DskipTests

# Build specific modules
./mvnw clean install -pl openframe-core,openframe-security-core
```

**Maven Profiles**
```xml
<!-- Add to ~/.m2/settings.xml -->
<profiles>
  <profile>
    <id>openframe-dev</id>
    <properties>
      <skipTests>false</skipTests>
      <maven.test.failure.ignore>false</maven.test.failure.ignore>
    </properties>
  </profile>
</profiles>
```

### Debug Configuration

**Remote Debugging**
```bash
# Start Spring Boot with debug port
java -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005 -jar app.jar

# Or use Maven
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=5005"
```

**IDE Debug Configuration**
```text
Run → Edit Configurations → Remote JVM Debug
Name: OpenFrame Remote Debug
Host: localhost
Port: 5005
```

### Performance Profiling

**JProfiler Integration**
```bash
# Add JProfiler agent to JVM args
-agentpath:/path/to/jprofiler/bin/[os]/libjprofilerti.so=port=8849
```

**Async Profiler**
```bash
# Download async-profiler
# https://github.com/jvm-profiling-tools/async-profiler

# Profile running application
java -jar async-profiler.jar -d 30 -f profile.html <pid>
```

## Environment Verification

### Health Check Script

Create `scripts/dev-health-check.sh`:

```bash
#!/bin/bash

echo "=== OpenFrame Development Environment Health Check ==="

# Java Version
echo "Java Version:"
java -version

# Maven Version  
echo -e "\nMaven Version:"
mvn --version

# Build Status
echo -e "\nBuild Test:"
mvn clean compile -q

# Database Connectivity
echo -e "\nDatabase Connectivity:"
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" --quiet
else
    echo "MongoDB CLI not available"
fi

# Redis Connectivity
if command -v redis-cli &> /dev/null; then
    redis-cli ping
else
    echo "Redis CLI not available"
fi

echo "=== Health Check Complete ==="
```

### IDE Performance Optimization

**IntelliJ Performance**
```text
Help → Edit Custom VM Options:
-Xmx4096m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC
-XX:SoftRefLRUPolicyMSPerMB=50
-XX:CICompilerCount=2
-Dsun.io.useCanonPrefixCache=false
```

**Memory Usage Monitoring**
```text
View → Appearance → Status Bar Widgets → Memory Indicator
Monitor memory usage and garbage collection
```

## Next Steps

With your development environment configured, you're ready for:

1. **[Local Development Setup](local-development.md)** - Run services locally
2. **[Architecture Overview](../architecture/README.md)** - Understand the system design  
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing

## Troubleshooting

**Common Issues:**

- **Lombok not working**: Ensure plugin installed and annotation processing enabled
- **Maven build failures**: Check Java version and `JAVA_HOME` setting
- **Out of memory errors**: Increase heap size in `MAVEN_OPTS`
- **Import issues**: Refresh Maven projects and reimport

**Performance Issues:**

- **IDE slowness**: Increase IDE memory allocation
- **Build slowness**: Use Maven daemon or increase parallel builds
- **Test slowness**: Consider using TestContainers for faster integration tests

Need help? Join the [OpenMSP Community Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) for support!