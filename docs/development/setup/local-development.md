# Local Development Guide

This guide walks you through setting up a complete local development environment for OpenFrame OSS Lib, including running services, databases, and external dependencies.

## Overview

OpenFrame OSS Lib is designed as a library collection rather than standalone services. However, for development and testing, you'll want to:

1. **Set up supporting services** (databases, messaging)
2. **Run integration tests** to verify functionality  
3. **Use test services** to explore API behaviors
4. **Debug individual modules** in isolation

## Quick Local Setup

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Build all modules
mvn clean install

# Verify build success
echo "Build complete. All JARs available in local Maven repository."
```

### 2. Start Supporting Services

Create a `docker-compose.dev.yml` for local development:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=openframe_dev
    volumes:
      - mongodb_data:/data/db
      
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
      
  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper
      
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
      
  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"
    command: ["--jetstream", "--http_port", "8222"]

volumes:
  mongodb_data:
  redis_data:
```

**Start the services:**

```bash
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

### 3. Configure Development Properties

Create `application-dev.properties` in your test resources:

```properties
# Database Configuration
spring.data.mongodb.uri=mongodb://localhost:27017/openframe_dev
spring.redis.host=localhost
spring.redis.port=6379

# Kafka Configuration  
spring.kafka.bootstrap-servers=localhost:9092
spring.kafka.consumer.group-id=openframe-dev
spring.kafka.consumer.auto-offset-reset=earliest

# NATS Configuration
nats.server.url=nats://localhost:4222

# Logging Configuration
logging.level.com.openframe=DEBUG
logging.level.org.springframework.security=DEBUG
logging.pattern.console=%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n

# Development-specific settings
openframe.dev.mode=true
openframe.security.jwt.secret=dev-secret-key-for-local-development-only
```

## Running Individual Modules

### API Service Development

The API Service Core is the main orchestration layer. Here's how to run it locally:

**1. Create a test application:**

```java
// src/test/java/com/openframe/api/ApiServiceTestApp.java
@SpringBootApplication
@ComponentScan(basePackages = "com.openframe")  
@EnableJpaRepositories(basePackages = "com.openframe.data.repository")
public class ApiServiceTestApp {
    public static void main(String[] args) {
        System.setProperty("spring.profiles.active", "dev");
        SpringApplication.run(ApiServiceTestApp.class, args);
    }
}
```

**2. Run the test application:**

```bash
cd openframe-api-service-core

# Run with Maven
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Or run the test class directly from your IDE
```

**3. Test the endpoints:**

```bash
# Health check
curl http://localhost:8080/actuator/health

# Test authentication endpoint (if configured)
curl -X POST http://localhost:8080/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=test&client_secret=test"
```

### Gateway Service Development

The Gateway Service handles routing and security:

**1. Gateway configuration:**

```yaml
# application-dev.yml for gateway testing
server:
  port: 8080
  
spring:
  cloud:
    gateway:
      routes:
        - id: api-service
          uri: http://localhost:8081
          predicates:
            - Path=/api/**
        - id: external-api
          uri: http://localhost:8082  
          predicates:
            - Path=/external/**
            
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8083/oauth2
```

**2. Run gateway:**

```bash
cd openframe-gateway-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=dev -Dserver.port=8080
```

### Client Service Development

For agent communication testing:

```bash  
cd openframe-client-core

# Run client service on different port
mvn spring-boot:run -Dspring-boot.run.profiles=dev -Dserver.port=8084
```

## Integration Testing

### Running Test Suite

OpenFrame includes comprehensive integration tests:

```bash
# Run all tests
mvn test

# Run tests for specific module
cd openframe-test-service-core
mvn test

# Run specific test category
mvn test -Dtest="*Device*"

# Run with specific profile
mvn test -Dspring.profiles.active=integration-test
```

### Test Configuration

The test service core provides realistic test scenarios:

```bash
# Explore available tests
ls openframe-test-service-core/src/main/java/com/openframe/test/tests/

# Key test categories:
# - AuthTokensTest: OAuth2 and JWT flows
# - DevicesTest: Device management APIs
# - OrganizationsTest: Multi-tenant scenarios  
# - UserInvitationsTest: User lifecycle
```

### Running Integration Tests with TestContainers

For more realistic testing, use TestContainers:

```java
@SpringBootTest
@Testcontainers
class IntegrationTest {
    
    @Container
    static MongoDBContainer mongodb = new MongoDBContainer("mongo:7")
            .withExposedPorts(27017);
            
    @Container  
    static GenericContainer redis = new GenericContainer("redis:7")
            .withExposedPorts(6379);
    
    @DynamicPropertySource
    static void setProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", mongodb::getReplicaSetUrl);
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", redis::getFirstMappedPort);
    }
}
```

## Database Setup & Management

### MongoDB Development

**1. Connect to local MongoDB:**

```bash
# Using mongosh (MongoDB Shell)
mongosh mongodb://localhost:27017/openframe_dev

# List collections
show collections

# Query sample data
db.users.find().pretty()
db.organizations.find().pretty()
```

**2. Initialize test data:**

```javascript
// Create test tenant
db.tenants.insertOne({
  _id: ObjectId(),
  domain: "dev-tenant.localhost",
  name: "Development Tenant",
  status: "ACTIVE"
});

// Create test user
db.users.insertOne({
  _id: ObjectId(),
  email: "dev@example.com",
  firstName: "Dev",
  lastName: "User",
  tenantId: "dev-tenant"
});
```

### Redis Development  

**1. Monitor Redis operations:**

```bash
# Connect to Redis CLI
redis-cli -h localhost -p 6379

# Monitor commands
MONITOR

# Check keys
KEYS openframe:*

# Get cached data
GET "openframe:tenant:dev-tenant"
```

**2. Clear development cache:**

```bash
# Clear all OpenFrame cache entries
redis-cli --scan --pattern "openframe:*" | xargs redis-cli del
```

## Hot Reload & Development Workflow

### Spring Boot DevTools

Add DevTools for automatic restarts:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

**Benefits:**
- Automatic application restart on code changes
- LiveReload support for static resources
- Enhanced development-time logging

### IDE Integration

**IntelliJ IDEA:**
```text
Build → Build Project (Ctrl+F9)
# Application automatically restarts

# Enable automatic compilation:
Settings → Build → Compiler → Build project automatically
```

**Eclipse/STS:**
```text
Project → Build Automatically (enabled)
# DevTools detects changes and restarts
```

## Debugging Individual Modules

### Debug Configuration

**1. Remote debugging:**

```bash
# Start any service with debug port
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"
```

**2. IDE debug configuration:**

```text
Run → Edit Configurations → Remote JVM Debug
Name: OpenFrame Debug
Host: localhost  
Port: 5005
```

### Module-Specific Debugging

**Security Module:**
```java
// Add breakpoints in:
// - JwtService.java (token processing)
// - AuthPrincipalArgumentResolver.java (authentication)
// - SecurityConfig.java (security configuration)
```

**Data Module:**
```java
// Debug points:
// - Repository implementations
// - Custom query methods  
// - Tenant isolation logic
```

**API Module:**  
```java
// Key debugging locations:
// - Controller methods
// - DTO mapping
// - GraphQL DataFetchers
```

## Performance Monitoring

### Application Metrics

Enable Spring Boot Actuator for monitoring:

```properties
# application-dev.properties
management.endpoints.web.exposure.include=health,metrics,info,env
management.endpoint.health.show-details=always
management.metrics.export.prometheus.enabled=true
```

**Access metrics:**
```bash
# Health status
curl http://localhost:8080/actuator/health

# JVM metrics  
curl http://localhost:8080/actuator/metrics/jvm.memory.used

# Custom business metrics
curl http://localhost:8080/actuator/metrics/openframe.api.requests
```

### Database Performance

**MongoDB profiling:**
```javascript
// Enable profiling for slow operations
db.setProfilingLevel(1, { slowms: 100 });

// View slow operations
db.system.profile.find().sort({ ts: -1 }).limit(5);
```

**Redis monitoring:**
```bash
# Monitor Redis performance
redis-cli --latency -h localhost -p 6379

# Check memory usage
redis-cli info memory
```

## Environment-Specific Configuration

### Development Profiles

Create environment-specific property files:

```text
src/main/resources/
├── application.properties              # Base configuration
├── application-dev.properties          # Local development  
├── application-integration-test.properties  # Integration testing
└── application-docker.properties       # Docker environment
```

### Configuration Management

**Environment variables override:**
```bash
export SPRING_PROFILES_ACTIVE=dev
export SPRING_DATA_MONGODB_URI=mongodb://localhost:27017/openframe_dev  
export OPENFRAME_SECURITY_JWT_SECRET=my-dev-secret
```

**IDE configuration:**
```text
Run Configuration → Environment Variables:
SPRING_PROFILES_ACTIVE=dev
OPENFRAME_LOG_LEVEL=DEBUG
```

## Troubleshooting

### Common Development Issues

**Build Issues:**
```bash
# Clear Maven cache and rebuild
rm -rf ~/.m2/repository/com/openframe
mvn clean install

# Skip tests if blocking
mvn clean install -DskipTests
```

**Database Connection Issues:**
```bash
# Check if services are running
docker-compose -f docker-compose.dev.yml ps

# Restart problematic services
docker-compose -f docker-compose.dev.yml restart mongodb redis
```

**Memory Issues:**
```bash
# Increase Maven memory
export MAVEN_OPTS="-Xmx4096m -XX:MaxPermSize=512m"

# Increase IDE memory (IntelliJ):
# Help → Edit Custom VM Options → Add -Xmx4096m
```

**Port Conflicts:**
```bash
# Find processes using ports
lsof -ti:8080 | xargs kill -9

# Use different ports
mvn spring-boot:run -Dserver.port=8081
```

### Logging & Diagnostics

**Enable debug logging:**
```properties
logging.level.com.openframe=DEBUG
logging.level.org.springframework.security=DEBUG
logging.level.org.springframework.data.mongodb=DEBUG
logging.level.org.apache.kafka=INFO
```

**Spring Boot diagnostics:**
```bash
# Check auto-configuration
curl http://localhost:8080/actuator/conditions

# View environment properties
curl http://localhost:8080/actuator/env
```

## Next Steps

With your local development environment running:

1. **[Architecture Overview](../architecture/README.md)** - Understand the system design
2. **[Security Guide](../security/README.md)** - Learn authentication patterns  
3. **[Testing Guide](../testing/README.md)** - Master the testing approach
4. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing

## Community Support

Need help with local development? 

- **Technical Questions**: [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Platform Info**: [OpenMSP Website](https://www.openmsp.ai/)
- **OpenFrame Product**: [https://flamingo.run](https://flamingo.run)

Happy coding! 🚀