# Development Environment Setup

This guide walks you through setting up a complete development environment for OpenFrame OSS Library. Whether you're contributing to the project or building applications with the library, this setup will give you everything you need.

## IDE Setup and Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best Java development experience for OpenFrame.

#### Installation

| Platform | Installation Method |
|----------|-------------------|
| **Windows** | Download from [JetBrains website](https://www.jetbrains.com/idea/download/#section=windows) |
| **macOS** | `brew install --cask intellij-idea` |
| **Linux** | Download tar.gz or use snap: `sudo snap install intellij-idea-community --classic` |

#### Essential Plugins

Install these plugins via **Settings → Plugins**:

```text
Required:
✅ Lombok Plugin (for @Data, @Builder annotations)
✅ Spring Boot Plugin (for Spring configuration)
✅ Database Tools and SQL (for MongoDB inspection)

Recommended:
🔶 SonarLint (code quality analysis)
🔶 CheckStyle-IDEA (code style enforcement)
🔶 Maven Helper (dependency management)
🔶 GitToolBox (enhanced Git integration)
🔶 Docker Plugin (container management)
```

#### IntelliJ Configuration

**1. Import Code Style**

```text
Settings → Editor → Code Style → Java
→ Import Scheme → Eclipse XML Profile
→ Select: config/codestyle/openframe-java-style.xml
```

**2. Configure Lombok**

```text
Settings → Build, Execution, Deployment → Compiler → Annotation Processors
✅ Enable annotation processing
✅ Obtain processors from project classpath
```

**3. Set Up Run Configurations**

Create run configurations for the example applications:

```text
Run → Edit Configurations → + → Spring Boot
Name: Device Management Example
Main class: com.openframe.examples.DeviceManagementApplication
Module: examples.device-management.main
Environment variables:
  SPRING_PROFILES_ACTIVE=development
  MONGODB_URI=mongodb://localhost:27017/openframe-dev
```

### Visual Studio Code (Alternative)

For developers who prefer VS Code:

#### Required Extensions

```bash
# Install VS Code extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension vmware.vscode-spring-boot
code --install-extension ms-vscode.vscode-json
code --install-extension ms-azuretools.vscode-docker
```

#### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "java.home": "/usr/lib/jvm/java-17-openjdk-amd64",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/usr/lib/jvm/java-17-openjdk-amd64"
    }
  ],
  "java.compile.nullAnalysis.mode": "automatic",
  "spring-boot.ls.checkJVM": false,
  "files.exclude": {
    "**/.gradle": true,
    "**/build": true,
    "**/.DS_Store": true
  }
}
```

## Project Import and Setup

### Clone and Import

```bash
# Clone the repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# Import in IntelliJ IDEA
# File → Open → Select openframe-oss-lib folder
# IntelliJ will automatically detect it as a Gradle project
```

### Gradle Configuration

Ensure Gradle is properly configured:

#### Gradle Wrapper Verification

```bash
# Verify Gradle wrapper
./gradlew --version

# Expected output:
# Gradle 8.5
# Build time: 2023-11-29 14:08:57 UTC
# Revision: 28aca86a7180baa17117e0e5ba01d8ea9feca598
# Kotlin: 1.9.20
# Groovy: 3.0.17
# Ant: Apache Ant(TM) version 1.10.13 compiled on January 4 2023
# JVM: 17.0.x (Eclipse Adoptium 17.0.x+x)
# OS: Linux x.x.x amd64
```

#### Build Configuration

Create `gradle.properties` for development:

```properties
# Gradle configuration
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=true

# JVM settings
org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=512m

# Spring Boot settings
spring.output.ansi.enabled=always

# Development settings
skipTests=false
```

### Database Setup for Development

#### MongoDB Development Configuration

Create MongoDB for development with Docker:

```bash
# Start MongoDB with persistent data
docker run --name mongodb-dev \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_DATABASE=openframe-dev \
  -d mongo:7.0

# Verify connection
mongosh mongodb://localhost:27017/openframe-dev --eval "db.adminCommand('ping')"
```

#### MongoDB Compass Setup

Install and configure MongoDB Compass for database management:

1. **Download**: [MongoDB Compass](https://www.mongodb.com/try/download/compass)
2. **Connect**: `mongodb://localhost:27017`
3. **Create Database**: `openframe-dev`

#### Redis Development Setup

```bash
# Start Redis for caching
docker run --name redis-dev \
  -p 6379:6379 \
  -d redis:7-alpine

# Test connection
redis-cli -h localhost -p 6379 ping
```

## Development Tools Configuration

### Git Configuration

Set up Git for OpenFrame development:

```bash
# Configure Git user
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Configure OpenFrame-specific settings
git config --local commit.template .gitmessage
git config --local core.autocrlf input
git config --local push.default simple

# Install Git hooks (optional)
cp config/git-hooks/* .git/hooks/
chmod +x .git/hooks/*
```

### Code Quality Tools

#### SpotBugs Configuration

Add SpotBugs to your IDE:

**IntelliJ IDEA:**
```text
Settings → Plugins → Install "SpotBugs"
Settings → Tools → SpotBugs
✅ Enable SpotBugs
Analysis effort: High
Report effort threshold: Low
```

#### Checkstyle Setup

Configure Checkstyle for code formatting:

```bash
# Download Google checkstyle configuration
curl -o config/checkstyle/google_checks.xml \
  https://raw.githubusercontent.com/checkstyle/checkstyle/master/src/main/resources/google_checks.xml

# Customize for OpenFrame
cp config/checkstyle/openframe_checks.xml config/checkstyle/checkstyle.xml
```

**IntelliJ Integration:**
```text
Settings → Tools → Checkstyle
+ Add → Description: "OpenFrame Style"
File: config/checkstyle/openframe_checks.xml
✅ Active
```

### API Testing Tools

#### Postman Configuration

1. **Install Postman**: [Download](https://www.postman.com/downloads/)
2. **Import Collection**: 
   ```bash
   # Import the OpenFrame API collection
   # File → Import → config/postman/OpenFrame-API.postman_collection.json
   ```
3. **Set Environment Variables**:
   ```json
   {
     "baseUrl": "http://localhost:8080",
     "mongodbUrl": "mongodb://localhost:27017",
     "redisUrl": "redis://localhost:6379"
   }
   ```

#### cURL Configuration

Create shell aliases for common API calls:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias of-devices='curl -H "Content-Type: application/json" http://localhost:8080/api/devices'
alias of-orgs='curl -H "Content-Type: application/json" http://localhost:8080/api/organizations'
alias of-health='curl http://localhost:8080/actuator/health'

# Source the file
source ~/.bashrc
```

## Environment Variables

### Development Environment File

Create `.env.development`:

```bash
# Application
SPRING_PROFILES_ACTIVE=development
SERVER_PORT=8080

# Database
MONGODB_URI=mongodb://localhost:27017/openframe-dev
REDIS_URL=redis://localhost:6379/0

# Security (development only)
JWT_SECRET=development-secret-key-change-in-production
SECURITY_ENABLED=false

# Logging
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_OPENFRAME=DEBUG
LOGGING_LEVEL_MONGODB=DEBUG

# Management endpoints
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,metrics,info,env,beans

# Development features
SPRING_DEVTOOLS_RESTART_ENABLED=true
SPRING_DEVTOOLS_LIVERELOAD_ENABLED=true
```

### IDE Environment Configuration

**IntelliJ IDEA Run Configuration:**

```text
Run/Debug Configurations → Environment variables:

SPRING_PROFILES_ACTIVE=development
MONGODB_URI=mongodb://localhost:27017/openframe-dev
REDIS_URL=redis://localhost:6379/0
LOGGING_LEVEL_OPENFRAME=DEBUG
```

**VS Code launch.json:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "DeviceManagementApplication",
      "request": "launch",
      "mainClass": "com.openframe.examples.DeviceManagementApplication",
      "env": {
        "SPRING_PROFILES_ACTIVE": "development",
        "MONGODB_URI": "mongodb://localhost:27017/openframe-dev",
        "REDIS_URL": "redis://localhost:6379/0"
      }
    }
  ]
}
```

## Development Workflow Setup

### Hot Reload Configuration

Enable Spring Boot DevTools for automatic restart:

**Add to `build.gradle`:**

```gradle
dependencies {
    developmentOnly 'org.springframework.boot:spring-boot-devtools'
}
```

**IntelliJ IDEA Auto-build:**

```text
Settings → Build, Execution, Deployment → Compiler
✅ Build project automatically

Settings → Advanced Settings  
✅ Allow auto-make to start even if developed application is currently running
```

### Testing Configuration

#### Test Database Setup

```bash
# Create test database
mongosh mongodb://localhost:27017/openframe-test --eval "db.dropDatabase()"

# Configure test properties
cat > src/test/resources/application-test.yml << EOF
spring:
  profiles:
    active: test
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe-test
  redis:
    host: localhost
    port: 6379
    database: 1

logging:
  level:
    com.openframe: DEBUG
EOF
```

#### Test Run Configuration

**IntelliJ IDEA Test Configuration:**

```text
Run/Debug Configurations → Templates → JUnit
Environment variables:
  SPRING_PROFILES_ACTIVE=test
  MONGODB_URI=mongodb://localhost:27017/openframe-test

VM options:
-Dspring.profiles.active=test
```

### Docker Development Setup (Optional)

For containerized development:

**Create `docker-compose.dev.yml`:**

```yaml
version: '3.8'
services:
  mongodb-dev:
    image: mongo:7.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: openframe-dev
    volumes:
      - mongodb_dev_data:/data/db
    
  redis-dev:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data

volumes:
  mongodb_dev_data:
  redis_dev_data:
```

**Start development services:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Verification and Testing

### Environment Verification

Run this script to verify your setup:

```bash
#!/bin/bash
# verify-dev-environment.sh

echo "🔍 Verifying OpenFrame Development Environment..."

# Check Java
echo "☕ Checking Java..."
java -version 2>&1 | grep "17\."
if [ $? -eq 0 ]; then
  echo "✅ Java 17+ detected"
else
  echo "❌ Java 17+ required"
  exit 1
fi

# Check Gradle
echo "🔨 Checking Gradle..."
./gradlew --version > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Gradle working"
else
  echo "❌ Gradle not working"
  exit 1
fi

# Check MongoDB
echo "🍃 Checking MongoDB..."
mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ MongoDB connected"
else
  echo "❌ MongoDB connection failed"
  exit 1
fi

# Check Redis
echo "🔴 Checking Redis..."
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Redis connected"
else
  echo "❌ Redis connection failed"
  exit 1
fi

echo "🎉 Development environment ready!"
```

### Build and Test

```bash
# Full build with tests
./gradlew clean build

# Quick build without tests
./gradlew clean build -x test

# Run specific test suite
./gradlew test --tests "*.DeviceServiceTest"

# Run integration tests
./gradlew integrationTest
```

## Troubleshooting

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Lombok not working** | Getters/setters not found | Enable annotation processing in IDE |
| **MongoDB connection** | Connection refused | Start MongoDB: `docker-compose up mongodb-dev` |
| **Port conflicts** | Address already in use | Kill process: `lsof -ti:8080 \| xargs kill -9` |
| **Gradle build fails** | Dependency download errors | Clear Gradle cache: `./gradlew --stop && rm -rf ~/.gradle/caches` |
| **Tests failing** | Database-related test failures | Reset test database: `mongosh openframe-test --eval "db.dropDatabase()"` |

### Getting Help

- 📖 **Documentation**: Check the [local development guide](local-development.md)
- 💬 **Community**: Ask in [GitHub Discussions](https://github.com/openframe/openframe-oss-lib/discussions)
- 🐛 **Bug Reports**: Create an issue on [GitHub](https://github.com/openframe/openframe-oss-lib/issues)

## Next Steps

With your development environment set up:

1. **[Local Development Guide](local-development.md)** - Learn to run and debug the application
2. **[Architecture Overview](../architecture/overview.md)** - Understand the system design
3. **[Testing Guide](../testing/overview.md)** - Write and run tests
4. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing

Your development environment is now ready! Time to start building amazing things with OpenFrame! 🚀