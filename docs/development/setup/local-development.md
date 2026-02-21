# Local Development Guide

This guide covers running OpenFrame OSS Libraries locally for development, including hot reloading, debugging, and testing workflows. You'll learn how to efficiently develop, test, and iterate on the platform.

## Development Prerequisites

Before starting local development, ensure you have completed:

1. **[Prerequisites](../../getting-started/prerequisites.md)** - System requirements and tools
2. **[Environment Setup](environment.md)** - IDE and development tools configuration

## Repository Setup

### Clone and Initial Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Create development branch
git checkout -b feature/your-feature-name

# Install dependencies
mvn clean install -DskipTests
```

### Development Environment Configuration

Create `application-development.yml` in `src/main/resources/`:

```yaml
spring:
  profiles:
    active: development
    
  # Development Database Settings
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe_dev
      
  data:
    redis:
      host: localhost
      port: 6379
      
  # Kafka Development Configuration
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: openframe-dev
      auto-offset-reset: latest
    producer:
      retries: 1
      
# Development Security Settings
openframe:
  security:
    jwt:
      secret: development-jwt-secret-minimum-32-characters
    oauth:
      encryption-key: development-encryption-key-32-chars!
      
# Enable detailed logging
logging:
  level:
    com.openframe: DEBUG
    org.springframework.security: DEBUG
    org.springframework.kafka: INFO
    org.mongodb.driver: INFO
    redis.clients.jedis: INFO
    
# Development server settings
server:
  port: 8080
  error:
    include-stacktrace: always
    include-message: always
    
# Actuator endpoints for development
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,beans,conditions
  endpoint:
    health:
      show-details: always
```

## Starting the Development Environment

### 1. Start Infrastructure Services

Use Docker Compose for development dependencies:

```bash
# Start all required services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose ps
```

Expected output:
```text
Name                Command               State                    Ports                  
---------------------------------------------------------------------------------------------
mongodb       docker-entrypoint.sh mongod    Up      0.0.0.0:27017->27017/tcp             
redis         docker-entrypoint.sh redis ... Up      0.0.0.0:6379->6379/tcp               
kafka         /etc/confluent/docker/run      Up      0.0.0.0:9092->9092/tcp               
zookeeper     /etc/confluent/docker/run      Up      2181/tcp, 2888/tcp, 3888/tcp         
```

### 2. Run the Application

#### Option A: Maven Spring Boot Plugin (Recommended)

```bash
# Navigate to the main service module
cd openframe-api-service-core

# Run with development profile
mvn spring-boot:run -Dspring-boot.run.profiles=development
```

#### Option B: IDE Run Configuration

**IntelliJ IDEA:**
1. Open `ApiServiceApplication.java`
2. Right-click → **Run 'ApiServiceApplication'**
3. Edit configuration:
   - **Program arguments**: `--spring.profiles.active=development`
   - **VM options**: `-Xmx2g -Dfile.encoding=UTF-8`

**VS Code:**
Create `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "OpenFrame API Service",
            "request": "launch",
            "mainClass": "com.openframe.api.ApiServiceApplication",
            "projectName": "openframe-api-service-core",
            "args": "--spring.profiles.active=development",
            "vmArgs": "-Xmx2g"
        }
    ]
}
```

#### Option C: Command Line JAR

```bash
# Build the application
mvn clean package -DskipTests

# Run the built JAR
java -jar openframe-api-service-core/target/openframe-api-service-core-*.jar \
     --spring.profiles.active=development
```

### 3. Verify Application Startup

Check the application logs for successful startup:

```text
  ____                   _____                          
 / __ \                 |  __ \                         
| |  | |_ __   ___ _ __ | |__) |_ __ __ _ _ __ ___   ___ 
| |  | | '_ \ / _ \ '_ \|  _  /| '__/ _` | '_ ` _ \ / _ \
| |__| | |_) |  __/ | | | | \ \| | | (_| | | | | | |  __/
 \____/| .__/ \___|_| |_|_|  \_\_|  \__,_|_| |_| |_|\___|
       | |                                               
       |_|                                               

OpenFrame API Service Core v5.32.0
Started ApiServiceApplication in 15.234 seconds (process running for 16.789)
```

Test endpoints:
```bash
# Health check
curl http://localhost:8080/health

# GraphQL playground
open http://localhost:8080/graphiql

# Actuator info
curl http://localhost:8080/actuator/health
```

## Hot Reloading and Live Development

### Enable Spring Boot DevTools

DevTools is included in the development dependencies. It provides:

- **Automatic restarts** when classpath changes
- **Live reload** for static resources
- **Enhanced development experience**

### IDE-Specific Hot Reloading

#### IntelliJ IDEA

1. **Enable automatic compilation:**
   - **File → Settings → Build, Execution, Deployment → Compiler**
   - Check "Build project automatically"

2. **Enable auto-make in running applications:**
   - **Help → Find Action** → Search for "Registry"
   - Find `compiler.automake.allow.when.app.running`
   - Enable the option

3. **Restart trigger:**
   - Make code changes
   - Application restarts automatically within 2-3 seconds

#### VS Code

Hot reloading works automatically with the Java Extension Pack when:
- Files are saved (Ctrl+S / Cmd+S)
- Auto-save is enabled

### Testing Hot Reloading

Make a simple change to test hot reloading:

```java
// In HealthController.java
@GetMapping("/health")
public ResponseEntity<Map<String, String>> health() {
    Map<String, String> status = new HashMap<>();
    status.put("status", "OK");
    status.put("timestamp", Instant.now().toString());
    status.put("version", "DEV-BUILD"); // Add this line
    return ResponseEntity.ok(status);
}
```

Save the file and observe the console:
```text
2024-01-15 10:30:45.123  INFO 12345 --- [  restartedMain] o.s.b.d.a.OptionalLiveReloadServer : LiveReload server is running on port 35729
2024-01-15 10:30:45.456  INFO 12345 --- [  restartedMain] c.o.api.ApiServiceApplication : Started ApiServiceApplication in 2.345 seconds
```

Test the change:
```bash
curl http://localhost:8080/health
# Should include the new "version" field
```

## Development Debugging

### Debug Configuration

#### IntelliJ IDEA Debug

1. **Set breakpoints** in your code
2. **Run → Debug 'ApiServiceApplication'**
3. Or use the debug icon next to the run configuration

#### Remote Debugging

For debugging in complex scenarios:

```bash
# Run with debug options
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"
```

Configure remote debug in IDE:
- **Host**: `localhost`
- **Port**: `5005`

### Database Debugging

#### MongoDB Queries

Enable MongoDB query logging:

```yaml
logging:
  level:
    org.springframework.data.mongodb.core: DEBUG
```

Use MongoDB Compass or command line:
```bash
mongosh "mongodb://localhost:27017/openframe_dev"
db.organizations.find().pretty()
```

#### Redis Operations

Monitor Redis commands:
```bash
# Monitor all commands
redis-cli monitor

# Check specific keys
redis-cli keys "*session*"
```

#### Kafka Message Debugging

Monitor Kafka topics:
```bash
# List topics
kafka-topics.sh --bootstrap-server localhost:9092 --list

# Consume messages
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic openframe-events --from-beginning
```

## Testing During Development

### Unit Tests

Run unit tests for specific modules:

```bash
# Run all tests
mvn test

# Run tests for specific module
mvn test -pl openframe-api-service-core

# Run specific test class
mvn test -Dtest=OrganizationServiceTest

# Run specific test method
mvn test -Dtest=OrganizationServiceTest#shouldCreateOrganization
```

### Integration Tests

Run integration tests with embedded databases:

```bash
# Run integration tests
mvn verify -P integration-tests

# Run with test containers
mvn verify -Dspring.profiles.active=test
```

### API Testing During Development

#### GraphQL Testing

Use the built-in GraphQL playground:

1. Navigate to `http://localhost:8080/graphiql`
2. Try sample queries:

```graphql
query GetOrganizations {
  organizations(first: 5) {
    edges {
      node {
        id
        name
        contactInformation {
          email
        }
      }
    }
  }
}
```

#### REST API Testing

**IntelliJ HTTP Client:**

Create `dev-tests.http`:
```http
### Health Check
GET http://localhost:8080/health

### Create Organization
POST http://localhost:8080/api/organizations
Content-Type: application/json

{
  "name": "Dev Test Org",
  "contactInformation": {
    "email": "test@dev.com"
  }
}

### GraphQL Query
POST http://localhost:8080/graphql
Content-Type: application/json

{
  "query": "{ organizations(first: 1) { edges { node { id name } } } }"
}
```

**curl Scripts:**

Create `scripts/dev-api-tests.sh`:
```bash
#!/bin/bash

BASE_URL="http://localhost:8080"

echo "Testing Health Endpoint..."
curl -s "${BASE_URL}/health" | jq

echo "Testing GraphQL..."
curl -s -X POST "${BASE_URL}/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { queryType { name } } }"}' | jq

echo "Testing Organizations API..."
curl -s "${BASE_URL}/api/organizations" | jq
```

## Common Development Workflows

### Adding a New Feature

1. **Create feature branch:**
```bash
git checkout -b feature/new-awesome-feature
```

2. **Write failing tests first (TDD):**
```java
@Test
void shouldProcessAwesomeFeature() {
    // Arrange
    var input = new AwesomeFeatureRequest("test");
    
    // Act & Assert
    assertThat(service.processAwesome(input))
        .isNotNull()
        .hasFieldOrPropertyWithValue("status", "processed");
}
```

3. **Implement the feature:**
```java
@Service
@RequiredArgsConstructor
public class AwesomeFeatureService {
    
    public AwesomeFeatureResponse processAwesome(AwesomeFeatureRequest request) {
        // Implementation
        return new AwesomeFeatureResponse("processed");
    }
}
```

4. **Test locally:**
```bash
mvn test -Dtest=AwesomeFeatureServiceTest
```

5. **Integration testing:**
```bash
# Start dev environment and test manually
curl -X POST http://localhost:8080/api/awesome-features \
  -H "Content-Type: application/json" \
  -d '{"name": "test feature"}'
```

### Debugging Database Issues

1. **Enable query logging:**
```yaml
logging:
  level:
    com.openframe.data: TRACE
    org.springframework.data.mongodb.core.MongoTemplate: DEBUG
```

2. **Use MongoDB Compass to inspect data**

3. **Check Redis cache:**
```bash
redis-cli keys "*"
redis-cli get "cache:organizations:123"
```

### Performance Testing During Development

1. **Enable JVM metrics:**
```yaml
management:
  metrics:
    enable:
      jvm: true
      process: true
      http: true
```

2. **Load testing with basic tools:**
```bash
# Simple load test
ab -n 1000 -c 10 http://localhost:8080/health

# GraphQL load test
echo '{"query":"{ __schema { types { name } } }"}' > query.json
ab -n 100 -c 5 -p query.json -T application/json http://localhost:8080/graphql
```

## Troubleshooting Development Issues

### Application Won't Start

**Common causes and solutions:**

1. **Port conflicts:**
```bash
# Check what's using port 8080
lsof -i :8080
kill -9 <PID>

# Or change port
--server.port=8081
```

2. **Database connection issues:**
```bash
# Check services
docker-compose ps

# Restart services
docker-compose restart mongodb redis
```

3. **Maven dependency conflicts:**
```bash
# Check for conflicts
mvn dependency:tree | grep -i conflict

# Force refresh
mvn clean install -U
```

### Hot Reload Not Working

1. **Verify DevTools is on classpath**
2. **Check IDE auto-compilation settings**
3. **Restart with clean build:**
```bash
mvn clean compile
```

### Memory Issues During Development

```bash
# Increase JVM memory
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=1g"

# Or in IDE run configuration:
-Xmx2g -XX:MaxMetaspaceSize=512m
```

### Database State Issues

```bash
# Reset development database
docker-compose down -v
docker-compose up -d

# Or reset specific service
docker-compose restart mongodb
mongosh --eval "db.dropDatabase()" openframe_dev
```

## Development Best Practices

### Code Quality Checks

Run before committing:

```bash
# Full build with tests
mvn clean verify

# Code style check
mvn checkstyle:check

# Security analysis
mvn spotbugs:check
```

### Git Workflow

```bash
# Before starting work
git pull origin main
git checkout -b feature/your-feature

# Regular commits
git add .
git commit -m "feat: implement awesome feature"

# Before pushing
mvn clean verify
git push origin feature/your-feature
```

### Environment Isolation

Keep development isolated:

- Use `openframe_dev` database name
- Use development-specific cache keys
- Use separate Kafka consumer groups
- Use development profiles consistently

## Next Steps

With local development running smoothly:

1. **[Architecture Overview](../architecture/README.md)** - Understand the system design
2. **[Security Guidelines](../security/README.md)** - Implement secure features
3. **[Testing Guide](../testing/README.md)** - Write comprehensive tests
4. **[Contributing Guidelines](../contributing/guidelines.md)** - Follow project conventions

## Getting Help

- **OpenMSP Slack**: [Development channel](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **GitHub Issues**: Report development problems
- **Stack Overflow**: Tag questions with `openframe`

---

*Your local development environment is now configured for productive OpenFrame OSS Libraries development!*