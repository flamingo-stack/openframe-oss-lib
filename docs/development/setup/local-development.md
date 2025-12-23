# Local Development Guide

This guide covers everything you need to know about running, debugging, and developing OpenFrame OSS Library locally. From the initial setup to advanced debugging techniques, this is your complete reference for local development.

## Clone and Initial Setup

### Repository Structure

When you clone OpenFrame OSS Library, you'll get this structure:

```text
openframe-oss-lib/
├── 📁 openframe-api-lib/           # Core API DTOs and services
├── 📁 openframe-data-mongo/        # MongoDB data models
├── 📁 openframe-core/              # Core utilities
├── 📁 openframe-security-core/     # Security components
├── 📁 openframe-client-core/       # Client service components
├── 📁 openframe-authorization-service-core/ # Auth service
├── 📁 openframe-gateway-service-core/       # Gateway service
├── 📁 openframe-management-service-core/    # Management service
├── 📁 examples/                    # Example applications
│   └── 📁 device-management/       # Device management example
├── 📄 build.gradle                 # Root build configuration
├── 📄 gradle.properties            # Gradle properties
└── 📄 docker-compose.yml           # Development dependencies
```

### Quick Clone and Setup

```bash
# Clone the repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# Check Java version
java -version  # Should be 17+

# Verify Gradle wrapper
./gradlew --version

# Start development dependencies
docker-compose up -d
```

## Running the Application Locally

### Method 1: Using Gradle (Recommended)

#### Start Dependencies First

```bash
# Start MongoDB and Redis
docker-compose up -d mongodb redis

# Verify services are running
docker ps
```

#### Build and Run

```bash
# Clean build (first time)
./gradlew clean build

# Run the device management example
./gradlew :examples:device-management:bootRun

# Or run with debug enabled
./gradlew :examples:device-management:bootRun --debug-jvm
```

#### Multiple Service Development

To run multiple services simultaneously:

```bash
# Terminal 1: API Service
./gradlew :openframe-api-service-core:bootRun

# Terminal 2: Authorization Service  
./gradlew :openframe-authorization-service-core:bootRun

# Terminal 3: Gateway Service
./gradlew :openframe-gateway-service-core:bootRun

# Terminal 4: Management Service
./gradlew :openframe-management-service-core:bootRun
```

### Method 2: Using IDE

#### IntelliJ IDEA

**1. Import Project**
```text
File → Open → Select openframe-oss-lib folder
IntelliJ will auto-detect Gradle project
```

**2. Create Run Configuration**
```text
Run → Edit Configurations → + → Spring Boot
Name: Device Management Local
Main class: com.openframe.examples.DeviceManagementApplication
Module: examples.device-management.main
Environment variables:
  SPRING_PROFILES_ACTIVE=development
  MONGODB_URI=mongodb://localhost:27017/openframe-dev
  SERVER_PORT=8080
```

**3. Run/Debug**
```text
Click the green run button or Shift+F10
For debugging: Click debug button or Shift+F9
```

#### VS Code

**1. Open Project**
```bash
cd openframe-oss-lib
code .
```

**2. Configure Launch Settings**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "Device Management",
      "request": "launch",
      "mainClass": "com.openframe.examples.DeviceManagementApplication",
      "projectName": "device-management",
      "env": {
        "SPRING_PROFILES_ACTIVE": "development",
        "MONGODB_URI": "mongodb://localhost:27017/openframe-dev",
        "SERVER_PORT": "8080"
      },
      "vmArgs": "-Dspring.profiles.active=development"
    },
    {
      "type": "java",
      "name": "Debug Device Management",
      "request": "launch",
      "mainClass": "com.openframe.examples.DeviceManagementApplication",
      "projectName": "device-management",
      "env": {
        "SPRING_PROFILES_ACTIVE": "development",
        "MONGODB_URI": "mongodb://localhost:27017/openframe-dev",
        "SERVER_PORT": "8080",
        "LOGGING_LEVEL_OPENFRAME": "DEBUG"
      }
    }
  ]
}
```

### Method 3: Using JAR Files

For production-like testing:

```bash
# Build JAR files
./gradlew bootJar

# Run the JAR
java -jar examples/device-management/build/libs/device-management-1.0.0.jar \
  --spring.profiles.active=development \
  --spring.data.mongodb.uri=mongodb://localhost:27017/openframe-dev
```

## Hot Reload and Development Features

### Spring Boot DevTools

DevTools provides automatic restart and live reload capabilities.

#### Enable DevTools

Already included in `build.gradle`:

```gradle
dependencies {
    developmentOnly 'org.springframework.boot:spring-boot-devtools'
}
```

#### DevTools Features

| Feature | Benefit | How to Use |
|---------|---------|------------|
| **Automatic Restart** | Restart app on classpath changes | Save file, app restarts automatically |
| **Live Reload** | Browser refresh on changes | Install LiveReload browser extension |
| **Property Defaults** | Development-friendly defaults | Automatic caching disabled |
| **Remote Debugging** | Connect debugger remotely | Use IDE remote debug configuration |

#### DevTools Configuration

Create `src/main/resources/application-development.yml`:

```yaml
spring:
  devtools:
    restart:
      enabled: true
      poll-interval: 1s
      quiet-period: 400ms
      exclude: static/**,public/**
    livereload:
      enabled: true
      port: 35729
  
  # Development optimizations
  jpa:
    show-sql: true
  data:
    mongodb:
      auto-index-creation: true
  
  # Disable caching
  cache:
    type: none
  thymeleaf:
    cache: false

# Enhanced logging for development
logging:
  level:
    com.openframe: DEBUG
    org.springframework.data.mongodb: DEBUG
    org.springframework.security: DEBUG
  pattern:
    console: "%clr(%d{HH:mm:ss.SSS}){blue} %clr(%-5level) %clr([%thread]){magenta} %clr(%logger{36}){cyan} - %msg%n"
```

### File Watching and Auto-rebuild

#### IntelliJ IDEA Auto-build

```text
Settings → Build, Execution, Deployment → Compiler
✅ Build project automatically

Registry (Ctrl+Shift+Alt+/)
✅ compiler.automake.allow.when.app.running = true
```

#### Gradle Continuous Build

```bash
# Continuous build - rebuilds on file changes
./gradlew --continuous build

# Continuous run - restarts on changes
./gradlew --continuous :examples:device-management:bootRun
```

## Debugging Techniques

### Application Debugging

#### Debug Mode Startup

```bash
# Start with debug port 5005
./gradlew :examples:device-management:bootRun --debug-jvm

# Or with custom debug port
JAVA_OPTS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5006" \
./gradlew :examples:device-management:bootRun
```

#### IDE Debug Connection

**IntelliJ IDEA:**
```text
Run → Edit Configurations → + → Remote JVM Debug
Host: localhost
Port: 5005
Command line arguments for running remote JVM:
-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
```

**VS Code:**
```json
{
  "type": "java",
  "name": "Debug (Attach)",
  "request": "attach",
  "hostName": "localhost",
  "port": 5005
}
```

### Database Debugging

#### MongoDB Query Debugging

Enable MongoDB query logging:

```yaml
# application-development.yml
logging:
  level:
    org.springframework.data.mongodb.core.MongoTemplate: DEBUG
    org.springframework.data.mongodb.repository: DEBUG
```

#### MongoDB Compass Integration

1. **Connect to local MongoDB**: `mongodb://localhost:27017`
2. **Select database**: `openframe-dev`
3. **Monitor collections in real-time**
4. **Execute test queries**

#### Redis Debugging

Monitor Redis operations:

```bash
# Monitor Redis commands in real-time
redis-cli monitor

# Check Redis keys
redis-cli keys "openframe:*"

# View specific key
redis-cli get "openframe:session:12345"

# Clear Redis cache for testing
redis-cli flushdb
```

### Logging Configuration

#### Development Logging Setup

**Detailed Application Logging:**

```yaml
logging:
  level:
    root: INFO
    com.openframe: DEBUG
    org.springframework.web: DEBUG
    org.springframework.security: DEBUG
    org.springframework.data.mongodb: DEBUG
  pattern:
    console: "%clr(%d{yyyy-MM-dd HH:mm:ss.SSS}){faint} %clr(%5p) %clr(${PID:- }){magenta} %clr(---){faint} %clr([%15.15t]){faint} %clr(%-40.40logger{39}){cyan} %clr(:){faint} %m%n%wEx"
    file: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
  file:
    name: logs/openframe-dev.log
```

#### Request/Response Logging

Log all HTTP requests and responses:

```yaml
logging:
  level:
    org.springframework.web.filter.CommonsRequestLoggingFilter: DEBUG
    org.springframework.web.servlet.DispatcherServlet: DEBUG

server:
  # Log request details
  servlet:
    context-path: /
  # Enable request logging
  undertow:
    accesslog:
      enabled: true
      dir: logs
```

### Performance Profiling

#### Spring Boot Actuator

Enable all actuator endpoints for development:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    health:
      show-details: always
    metrics:
      enabled: true
  metrics:
    export:
      simple:
        enabled: true
```

**Useful Actuator Endpoints:**

| Endpoint | Purpose | URL |
|----------|---------|-----|
| **Health Check** | Application health | `http://localhost:8080/actuator/health` |
| **Metrics** | Application metrics | `http://localhost:8080/actuator/metrics` |
| **Environment** | Configuration properties | `http://localhost:8080/actuator/env` |
| **Beans** | Spring beans | `http://localhost:8080/actuator/beans` |
| **Thread Dump** | Thread analysis | `http://localhost:8080/actuator/threaddump` |
| **Heap Dump** | Memory analysis | `http://localhost:8080/actuator/heapdump` |

#### JVM Profiling

**Enable JFR (Java Flight Recorder):**

```bash
# Start with JFR enabled
JAVA_OPTS="-XX:+FlightRecorder -XX:StartFlightRecording=duration=30s,filename=openframe-profile.jfr" \
./gradlew :examples:device-management:bootRun
```

**Memory Analysis:**

```bash
# Generate heap dump
jcmd <pid> GC.run_finalization
jcmd <pid> VM.gc
jcmd <pid> GC.dump_heap heap-dump.hprof

# Analyze with jhat
jhat heap-dump.hprof
# Visit http://localhost:7000
```

## Testing During Development

### Unit Testing

#### Run Tests During Development

```bash
# Run all tests
./gradlew test

# Run tests continuously
./gradlew --continuous test

# Run specific test class
./gradlew test --tests "*DeviceServiceTest"

# Run tests with detailed output
./gradlew test --info

# Run tests for specific module
./gradlew :openframe-api-lib:test
```

#### Test Configuration

**Test Database Setup:**

```yaml
# src/test/resources/application-test.yml
spring:
  profiles:
    active: test
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe-test
  redis:
    host: localhost
    port: 6379
    database: 1  # Use different database for tests

logging:
  level:
    com.openframe: DEBUG
    org.springframework.test: DEBUG
```

### Integration Testing

#### Testcontainers Integration

Run integration tests with real databases:

```bash
# Run integration tests (uses Testcontainers)
./gradlew integrationTest

# Or run specific integration test
./gradlew integrationTest --tests "*DeviceRepositoryIntegrationTest"
```

#### Manual Integration Testing

```bash
# Reset test database
mongosh mongodb://localhost:27017/openframe-test --eval "db.dropDatabase()"

# Run application in test mode
SPRING_PROFILES_ACTIVE=test ./gradlew :examples:device-management:bootRun

# Test with curl
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "machineId": "test-machine",
    "serialNumber": "TEST123456",
    "model": "Test Device",
    "type": "DESKTOP",
    "status": "ACTIVE"
  }'
```

## Local Configuration Management

### Environment-Specific Configuration

#### Development Configuration

**`application-development.yml`:**

```yaml
spring:
  profiles:
    active: development
  
  # Database configuration
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe-dev
      auto-index-creation: true
  
  # Cache configuration  
  redis:
    host: localhost
    port: 6379
    database: 0
    timeout: 2000ms
  
  # Security disabled for local development
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: fake-client-id
            client-secret: fake-client-secret

# Server configuration
server:
  port: 8080
  servlet:
    context-path: /

# OpenFrame specific configuration
openframe:
  security:
    enabled: false
    jwt:
      secret: development-secret-key
  pagination:
    default-size: 20
    max-size: 100
  features:
    audit-logging: true
    metrics-collection: true

# Development tools
management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    health:
      show-details: always

# Enhanced logging
logging:
  level:
    com.openframe: DEBUG
    org.springframework.data: DEBUG
  pattern:
    console: "%clr(%d{HH:mm:ss.SSS}){blue} %clr(%-5level) %clr([%thread]){magenta} %clr(%logger{36}){cyan} - %msg%n"
```

#### Local Override Configuration

Create `application-local.yml` (gitignored) for personal settings:

```yaml
# Personal development settings
spring:
  data:
    mongodb:
      uri: mongodb://your-custom-host:27017/your-db
  
server:
  port: 8081  # Custom port

logging:
  level:
    com.openframe.your.package: TRACE  # Extra debugging
```

### Environment Variables

Create `.env.local` file:

```bash
# Database URLs
MONGODB_URI=mongodb://localhost:27017/openframe-dev
REDIS_URL=redis://localhost:6379/0

# Application settings
SERVER_PORT=8080
SPRING_PROFILES_ACTIVE=development

# Security settings (development only)
JWT_SECRET=development-jwt-secret-key
SECURITY_ENABLED=false

# Feature flags
FEATURE_AUDIT_LOGGING=true
FEATURE_METRICS_COLLECTION=true

# External integrations (optional)
FLEET_MDM_URL=http://localhost:8000
TACTICAL_RMM_URL=http://localhost:8001

# Debug settings
LOGGING_LEVEL_OPENFRAME=DEBUG
DEBUG_MODE=true
```

## Troubleshooting Local Development

### Common Issues and Solutions

#### Build Issues

**1. Gradle Build Failure**

```bash
# Clear Gradle cache
./gradlew --stop
rm -rf ~/.gradle/caches/

# Clean build
./gradlew clean build --refresh-dependencies

# Check for dependency conflicts
./gradlew dependencies
```

**2. Compilation Errors**

```bash
# Check Java version
java -version
echo $JAVA_HOME

# Refresh IDE project
# IntelliJ: File → Reload Gradle Project
# VS Code: Java: Restart Projects (Ctrl+Shift+P)
```

#### Runtime Issues

**1. Port Already in Use**

```bash
# Find process using port
lsof -i :8080
netstat -tlnp | grep :8080

# Kill process
kill -9 <PID>

# Or change port
export SERVER_PORT=8081
```

**2. Database Connection Issues**

```bash
# Check MongoDB status
docker ps | grep mongo
mongosh --eval "db.adminCommand('ping')"

# Restart MongoDB
docker-compose restart mongodb

# Check logs
docker logs mongodb
```

**3. Memory Issues**

```bash
# Increase heap size
export JAVA_OPTS="-Xmx2g -Xms1g"

# Monitor memory usage
jstat -gc <pid> 1s
```

#### Development Workflow Issues

**1. Hot Reload Not Working**

```text
IntelliJ IDEA:
- Settings → Build → Compiler → Build project automatically ✅
- Registry → compiler.automake.allow.when.app.running ✅

VS Code:
- Ensure Java Extension Pack is installed
- Restart Java Language Server
```

**2. Tests Failing**

```bash
# Reset test database
mongosh mongodb://localhost:27017/openframe-test --eval "db.dropDatabase()"

# Clear test cache
./gradlew cleanTest test

# Run with debug info
./gradlew test --info --stacktrace
```

### Debug Commands

#### Application Health Check

```bash
#!/bin/bash
# health-check.sh

echo "🏥 OpenFrame Health Check"

# Check application
curl -s http://localhost:8080/actuator/health | jq '.'

# Check MongoDB
mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null && echo "✅ MongoDB OK" || echo "❌ MongoDB DOWN"

# Check Redis
redis-cli ping 2>/dev/null && echo "✅ Redis OK" || echo "❌ Redis DOWN"

# Check processes
echo "📊 Process Status:"
ps aux | grep -E '(java|mongod|redis)' | grep -v grep
```

#### Development Status

```bash
#!/bin/bash
# dev-status.sh

echo "🔧 Development Environment Status"

echo "📁 Project Directory: $(pwd)"
echo "☕ Java Version: $(java -version 2>&1 | head -n 1)"
echo "🔨 Gradle Version: $(./gradlew --version | head -n 3 | tail -n 1)"
echo "🍃 MongoDB: $(mongosh --quiet --eval 'db.version()' 2>/dev/null || echo 'Not running')"
echo "🔴 Redis: $(redis-cli --version 2>/dev/null || echo 'Not installed')"

echo "🌐 Active Ports:"
netstat -tlnp 2>/dev/null | grep -E ':(8080|27017|6379)' || echo "No OpenFrame ports active"
```

## Next Steps

Now that you have local development running smoothly:

1. **[Architecture Overview](../architecture/overview.md)** - Understand the system design
2. **[Testing Guide](../testing/overview.md)** - Write comprehensive tests
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing to the project

## Need Help?

- 💬 **GitHub Discussions** - Ask the community
- 🐛 **GitHub Issues** - Report bugs or request features
- 📖 **Documentation** - Check other guides in this repository
- 📧 **Email** - Contact the maintainers for complex issues

Happy coding! 🎉 You're now ready to develop amazing features with OpenFrame OSS Library.