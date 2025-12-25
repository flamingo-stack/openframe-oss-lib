# Local Development Guide

This guide covers running OpenFrame services locally, enabling hot reload for rapid development, and setting up debugging configurations for effective troubleshooting.

## Quick Start: Running Services Locally

### Start Infrastructure Services

First, ensure all required infrastructure services are running:

```bash
# Navigate to your OpenFrame project directory
cd openframe-oss-lib

# Start development infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

**Expected output:**
```bash
Name                          Command               State            Ports
--------------------------------------------------------------------------------
openframe-dev-kafka          /etc/confluent/docker/run   Up      0.0.0.0:9092->9092/tcp
openframe-dev-mongodb        docker-entrypoint.sh mongod Up      0.0.0.0:27017->27017/tcp
openframe-dev-mongo-express  tini -- /docker-entrypoint. Up      0.0.0.0:8081->8081/tcp
openframe-dev-redis          docker-entrypoint.sh redis  Up      0.0.0.0:6379->6379/tcp
openframe-dev-zookeeper      /etc/confluent/docker/run   Up      0.0.0.0:2181->2181/tcp
```

### Build All Modules

```bash
# Clean build all OpenFrame modules
mvn clean install -DskipTests

# This installs all modules to your local Maven repository
# Takes ~2-3 minutes on first run
```

## Running Individual Services

OpenFrame is designed as a collection of microservices. Here's how to run them individually for development.

### API Service

The main API service provides REST and GraphQL endpoints.

**Create a launcher module:**

```bash
mkdir -p dev-launchers/api-service
cd dev-launchers/api-service
```

**`pom.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.openframe.dev</groupId>
    <artifactId>api-service-launcher</artifactId>
    <version>1.0.0</version>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <properties>
        <java.version>21</java.version>
        <openframe.version>5.10.1</openframe.version>
    </properties>

    <dependencies>
        <!-- OpenFrame Core Services -->
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-api-service-core</artifactId>
            <version>${openframe.version}</version>
        </dependency>
        
        <!-- Development Tools -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

**`src/main/java/com/openframe/dev/ApiServiceApplication.java`:**
```java
package com.openframe.dev;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {
    "com.openframe.api.service.core",
    "com.openframe.data.config",
    "com.openframe.security.config"
})
public class ApiServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ApiServiceApplication.class, args);
    }
}
```

**`src/main/resources/application-dev.yml`:**
```yaml
spring:
  application:
    name: openframe-api-service
  
  profiles:
    active: dev
  
  data:
    mongodb:
      uri: mongodb://admin:password123@localhost:27017/openframe_dev?authSource=admin
    
    redis:
      host: localhost
      port: 6379
      database: 1

  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: openframe-api-dev
      auto-offset-reset: earliest

server:
  port: 8080

logging:
  level:
    com.openframe: DEBUG
    org.springframework.security: DEBUG
    org.springframework.data.mongodb.core.MongoTemplate: DEBUG

management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    health:
      show-details: always

# OpenFrame specific configuration
openframe:
  security:
    jwt:
      secret: dev-secret-key-please-change-in-production-use-proper-256-bit-key
      expiration: 86400
  
  data:
    initialization:
      enabled: true
```

**Start the API service:**
```bash
cd dev-launchers/api-service
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Gateway Service

The gateway service handles routing and authentication.

**Create gateway launcher:**

```bash
mkdir -p dev-launchers/gateway-service
cd dev-launchers/gateway-service
```

Similar setup as API service, but use `openframe-gateway-service-core` dependency and run on port 8081:

```yaml
server:
  port: 8081
```

### Client Service

Handles agent connectivity and device management.

```bash
mkdir -p dev-launchers/client-service
cd dev-launchers/client-service
```

Use `openframe-client-core` dependency and run on port 8082.

## Hot Reload Configuration

### Spring Boot DevTools

DevTools is already included in the launcher projects and provides:

- **Automatic Restart**: Restarts application when classpath changes
- **Live Reload**: Refreshes browser when resources change
- **Property Defaults**: Development-friendly default properties

### IDE-Specific Hot Reload

#### IntelliJ IDEA

**Enable automatic compilation:**
1. `File` → `Settings` → `Build, Execution, Deployment` → `Compiler`
2. ✅ Build project automatically
3. ✅ Compile independent modules in parallel

**Enable hot swap:**
1. `Run/Debug Configurations` → Select your configuration
2. `On 'Update' action` → `Update classes and resources`
3. `On frame deactivation` → `Update classes and resources`

**Use the following JVM options:**
```bash
-XX:+AllowEnhancedClassRedefinition
-javaagent:/path/to/hotswap-agent.jar
```

#### VS Code

Add to `.vscode/settings.json`:
```json
{
    "java.autobuild.enabled": true,
    "java.compile.nullAnalysis.mode": "automatic",
    "spring-boot.ls.java.home": "/path/to/java21"
}
```

### File Watching Script

For manual hot reload, create a file watcher:

```bash
#!/bin/bash
# scripts/dev-watch.sh

echo "🔍 Watching for file changes..."

# Watch for Java file changes and recompile
fswatch -o src/main/java/ | while read f; do
    echo "📝 Files changed, recompiling..."
    mvn compile -q
    
    # Trigger DevTools restart
    touch target/classes/restart.txt
    
    echo "✅ Recompilation complete"
done
```

## Debugging Configuration

### Remote Debugging

Start any service with debugging enabled:

```bash
# API Service with debug port 5005
mvn spring-boot:run \
    -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005" \
    -Dspring-boot.run.profiles=dev

# Gateway Service with debug port 5006  
mvn spring-boot:run \
    -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5006" \
    -Dspring-boot.run.profiles=dev
```

#### IDE Debug Configuration

**IntelliJ IDEA:**
1. `Run` → `Edit Configurations`
2. Add `Remote JVM Debug`
3. Set `Host: localhost`, `Port: 5005`
4. Set breakpoints and attach debugger

**VS Code:**
Add to `.vscode/launch.json`:
```json
{
    "type": "java",
    "name": "Debug OpenFrame API",
    "request": "attach",
    "hostName": "localhost",
    "port": 5005
}
```

### Advanced Debugging

#### JVM Flight Recorder

```bash
# Start with flight recording
mvn spring-boot:run \
    -Dspring-boot.run.jvmArguments="-XX:+FlightRecorder -XX:StartFlightRecording=duration=60s,filename=openframe.jfr"

# Analyze with JProfiler or VisualVM
```

#### Memory Analysis

```bash
# Enable heap dumps on OutOfMemoryError
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/openframe-heapdump.hprof

# Generate heap dump manually
jcmd <pid> GC.run_finalization
jcmd <pid> VM.gc
jcmd <pid> GC.heap_dump /tmp/heap-dump.hprof
```

## Development Workflows

### Multi-Service Development

When working on features that span multiple services, use this workflow:

```mermaid
graph TD
    A[Start Infrastructure] --> B[Start Gateway:8081]
    B --> C[Start API:8080]
    C --> D[Start Client:8082]
    D --> E[Test Integration]
    E --> F{Feature Complete?}
    F -->|No| G[Code Changes]
    G --> H[Hot Reload]
    H --> E
    F -->|Yes| I[Write Tests]
    I --> J[Commit Changes]
```

### Service Startup Script

Create `scripts/dev-start-all.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting OpenFrame development environment..."

# Check if infrastructure is running
if ! docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo "📦 Starting infrastructure services..."
    docker-compose -f docker-compose.dev.yml up -d
    sleep 15
fi

# Start services in background
echo "🌐 Starting Gateway Service on :8081..."
(cd dev-launchers/gateway-service && mvn spring-boot:run -Dspring-boot.run.profiles=dev) &
GATEWAY_PID=$!

sleep 10

echo "🔌 Starting API Service on :8080..."
(cd dev-launchers/api-service && mvn spring-boot:run -Dspring-boot.run.profiles=dev) &
API_PID=$!

sleep 10

echo "📱 Starting Client Service on :8082..."
(cd dev-launchers/client-service && mvn spring-boot:run -Dspring-boot.run.profiles=dev) &
CLIENT_PID=$!

# Wait for services to start
sleep 20

echo "✅ All services started!"
echo "🌐 Gateway: http://localhost:8081"
echo "🔌 API: http://localhost:8080"
echo "📱 Client: http://localhost:8082"
echo "💾 MongoDB: http://localhost:8081 (admin/password123)"

# Wait for user to stop
echo "Press Ctrl+C to stop all services..."
trap "kill $GATEWAY_PID $API_PID $CLIENT_PID; exit" INT TERM
wait
```

### Testing Integration

Test that services are communicating correctly:

```bash
# Test service health
curl http://localhost:8081/actuator/health  # Gateway
curl http://localhost:8080/actuator/health  # API  
curl http://localhost:8082/actuator/health  # Client

# Test gateway routing to API
curl http://localhost:8081/api/health

# Create test organization through gateway
curl -X POST http://localhost:8081/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Development MSP",
    "domain": "dev-msp.local",
    "email": "dev@msp.local",
    "phone": "+1-555-DEV1"
  }'
```

## Performance Monitoring

### Application Metrics

All services expose actuator endpoints for monitoring:

```bash
# Memory usage
curl http://localhost:8080/actuator/metrics/jvm.memory.used

# HTTP metrics  
curl http://localhost:8080/actuator/metrics/http.server.requests

# Custom OpenFrame metrics
curl http://localhost:8080/actuator/metrics/openframe.devices.total
curl http://localhost:8080/actuator/metrics/openframe.events.processed
```

### Database Monitoring

Monitor MongoDB performance:

```bash
# MongoDB stats
docker exec openframe-dev-mongodb mongosh --eval "db.stats()"

# Redis stats
docker exec openframe-dev-redis redis-cli info stats

# Kafka consumer lag
docker exec openframe-dev-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group openframe-api-dev
```

## Troubleshooting

### Service Won't Start

<details>
<summary>Port already in use</summary>

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 $(lsof -t -i:8080)

# Or use different port
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8090
```
</details>

<details>
<summary>Database connection failed</summary>

```bash
# Check MongoDB container
docker logs openframe-dev-mongodb

# Test connection manually
mongosh "mongodb://admin:password123@localhost:27017/?authSource=admin"

# Restart MongoDB
docker restart openframe-dev-mongodb
```
</details>

<details>
<summary>Hot reload not working</summary>

**IntelliJ IDEA:**
1. Check auto-compilation is enabled
2. Verify DevTools is on classpath  
3. Try rebuilding project
4. Check file system permissions

**VS Code:**
1. Restart Java language server
2. Check workspace trust settings
3. Verify Java extension is enabled
</details>

### Performance Issues

<details>
<summary>Application slow startup</summary>

**Solutions:**
- Increase JVM memory: `-Xmx2G -Xms1G`
- Use parallel GC: `-XX:+UseParallelGC`
- Reduce logging verbosity
- Disable unnecessary auto-configuration
</details>

<details>
<summary>High memory usage</summary>

**Diagnosis:**
```bash
# Get heap dump
jcmd <pid> GC.heap_dump /tmp/heapdump.hprof

# Analyze with Eclipse MAT or VisualVM
```

**Common causes:**
- Memory leaks in caches
- Too many database connections
- Large collections in memory
</details>

## Best Practices

### Development Efficiency

1. **Use Profiles**: Keep development settings separate
2. **Hot Reload**: Configure IDE for automatic compilation
3. **Service Isolation**: Test services independently
4. **Mock External Services**: Use WireMock for external API dependencies
5. **Database Seeding**: Create dev data scripts for consistent testing

### Code Quality

1. **Immediate Feedback**: Use IDE inspections and linting
2. **Unit Testing**: Write tests as you develop
3. **Integration Testing**: Test service interactions regularly
4. **Code Coverage**: Monitor coverage with JaCoCo
5. **Documentation**: Keep README and docs updated

### Resource Management

1. **Container Limits**: Set memory/CPU limits on development containers
2. **Connection Pooling**: Configure appropriate pool sizes
3. **Log Management**: Use appropriate log levels and rotation
4. **Cleanup**: Regularly clean up test data and containers

## Next Steps

✅ **Local Development Running?** Continue to [Architecture Overview](../architecture/overview.md) to understand how everything fits together.

---

You now have a complete local development environment for OpenFrame! You can develop, debug, and test with hot reload capabilities across all services. 🚀