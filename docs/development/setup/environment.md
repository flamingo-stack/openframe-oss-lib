# Development Environment Setup

This guide walks you through setting up a comprehensive development environment for OpenFrame OSS Lib, including IDE configuration, development tools, and local services.

## IDE Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best development experience for Spring Boot and multi-module Maven projects.

#### Required Plugins

Install these plugins via **File → Settings → Plugins**:

| Plugin | Purpose |
|--------|---------|
| **Lombok Plugin** | Reduces boilerplate code generation |
| **Spring Boot Plugin** | Spring Boot application support |
| **Database Tools and SQL** | Database integration |
| **Docker** | Container management |
| **GraphQL** | GraphQL schema support |

#### Project Configuration

```bash
# Open OpenFrame OSS Lib in IntelliJ
File → Open → select openframe-oss-lib directory

# Configure Project SDK
File → Project Structure → Project → Project SDK: Java 21

# Configure Maven
File → Settings → Build, Execution, Deployment → Build Tools → Maven
- Maven home directory: /path/to/maven
- User settings file: ~/.m2/settings.xml
- Use plugin registry: true
```

#### Code Style Configuration

```bash
# Import code style settings
File → Settings → Editor → Code Style → Java
- Import Scheme → IntelliJ IDEA code style XML
- Use Google Java Style Guide or create custom rules
```

#### Run Configurations

Create run configurations for key modules:

1. **API Service Core**
   - Main class: `com.openframe.api.ApiServiceApplication`
   - VM options: `-Dspring.profiles.active=dev -Xmx2G`
   - Program arguments: `--server.port=8080`

2. **Authorization Service Core**  
   - Main class: `com.openframe.authz.AuthorizationServiceApplication`
   - VM options: `-Dspring.profiles.active=dev -Xmx1G`
   - Program arguments: `--server.port=8082`

3. **Gateway Service Core**
   - Main class: `com.openframe.gateway.GatewayServiceApplication`
   - VM options: `-Dspring.profiles.active=dev -Xmx1G`
   - Program arguments: `--server.port=8081`

### Visual Studio Code

For developers preferring VS Code:

#### Required Extensions

```json
{
  "recommendations": [
    "vscjava.vscode-java-pack",
    "vmware.vscode-spring-boot",
    "gabrielbb.vscode-lombok",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-azuretools.vscode-docker"
  ]
}
```

#### Settings Configuration

Create `.vscode/settings.json`:

```json
{
  "java.home": "/path/to/java-21",
  "java.configuration.maven.userSettings": "~/.m2/settings.xml",
  "java.compile.nullAnalysis.mode": "automatic",
  "spring-boot.ls.problem.application-properties.enabled": true,
  "files.exclude": {
    "**/target": true,
    "**/.classpath": true,
    "**/.project": true,
    "**/.settings": true,
    "**/.factorypath": true
  }
}
```

## Development Tools

### Maven Configuration

Create or update `~/.m2/settings.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">

  <localRepository>~/.m2/repository</localRepository>

  <profiles>
    <profile>
      <id>openframe-dev</id>
      <properties>
        <spring.profiles.active>dev</spring.profiles.active>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
      </properties>
    </profile>
  </profiles>

  <activeProfiles>
    <activeProfile>openframe-dev</activeProfile>
  </activeProfiles>

</settings>
```

### Database Tools

#### MongoDB Compass (GUI)

```bash
# Install MongoDB Compass for visual database management
# Download from: https://www.mongodb.com/products/compass

# Connect to local development instance
mongodb://localhost:27017/openframe-dev
```

#### Redis CLI and GUI

```bash
# Install redis-cli for command-line access
brew install redis  # macOS
apt install redis-tools  # Ubuntu

# Optional: Install Redis GUI
# - RedisInsight: https://redislabs.com/redis-enterprise/redis-insight/
# - Another Redis Desktop Manager: https://github.com/qishibo/AnotherRedisDesktopManager
```

### Docker Development Stack

Create `docker-compose.dev.yml` for comprehensive development environment:

```yaml
version: '3.8'

services:
  # Core Data Services
  mongodb:
    image: mongo:7
    container_name: openframe-mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: openframe-dev
    volumes:
      - mongodb_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js
    networks:
      - openframe-net

  redis:
    image: redis:7-alpine
    container_name: openframe-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass password
    volumes:
      - redis_data:/data
    networks:
      - openframe-net

  # Message Streaming
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: openframe-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
    networks:
      - openframe-net

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: openframe-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - openframe-net

  # Analytics (Optional - for full stack development)
  cassandra:
    image: cassandra:4.1
    container_name: openframe-cassandra
    ports:
      - "9042:9042"
    environment:
      CASSANDRA_CLUSTER_NAME: openframe-cluster
      CASSANDRA_ENDPOINT_SNITCH: GossipingPropertyFileSnitch
      CASSANDRA_DC: datacenter1
    volumes:
      - cassandra_data:/var/lib/cassandra
    networks:
      - openframe-net
    healthcheck:
      test: ["CMD", "cqlsh", "-e", "describe keyspaces"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Development Utilities
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: openframe-kafka-ui
    depends_on:
      - kafka
    ports:
      - "8090:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
    networks:
      - openframe-net

volumes:
  mongodb_data:
  redis_data:
  zookeeper_data:
  kafka_data:
  cassandra_data:

networks:
  openframe-net:
    driver: bridge
```

#### Start Development Stack

```bash
# Start all development services
docker-compose -f docker-compose.dev.yml up -d

# Check service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f mongodb redis kafka

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## Environment Configuration

### Development Environment Variables

Create `.env.dev` file:

```bash
# Database Configuration
MONGODB_URI=mongodb://admin:password@localhost:27017/openframe-dev?authSource=admin
REDIS_URL=redis://:password@localhost:6379
CASSANDRA_CONTACT_POINTS=localhost:9042
CASSANDRA_KEYSPACE=openframe_dev

# Kafka Configuration  
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CLIENT_ID=openframe-dev
KAFKA_GROUP_ID=openframe-dev-group

# Security Configuration
JWT_SECRET_KEY=dev-jwt-secret-key-change-in-production
ENCRYPTION_SECRET_KEY=dev-encryption-key-32-characters-long
RSA_KEY_SIZE=2048

# OAuth2 Configuration
OAUTH2_CLIENT_ID=openframe-dev-client
OAUTH2_CLIENT_SECRET=dev-client-secret
OAUTH2_ISSUER_URI=http://localhost:8082

# External Service Configuration (Optional)
FLEET_MDM_API_URL=https://demo.fleetdm.com
TACTICAL_RMM_API_URL=https://demo.tacticalrmm.com
FLEET_MDM_API_TOKEN=demo-token
TACTICAL_RMM_API_TOKEN=demo-token

# Email Configuration (for invitation testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=dev@example.com
SMTP_PASSWORD=app-password

# Logging Configuration
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_OPENFRAME=DEBUG
LOGGING_LEVEL_SPRING_SECURITY=DEBUG

# Application Ports
API_SERVICE_PORT=8080
GATEWAY_SERVICE_PORT=8081
AUTHORIZATION_SERVICE_PORT=8082
EXTERNAL_API_SERVICE_PORT=8083
```

### Spring Boot Profiles

Create `application-dev.yml` in each module's `src/main/resources/`:

```yaml
spring:
  profiles:
    active: dev
  
  datasource:
    mongodb:
      uri: ${MONGODB_URI}
    
  redis:
    url: ${REDIS_URL}
    timeout: 2000ms
    
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS}
    client-id: ${KAFKA_CLIENT_ID}
    consumer:
      group-id: ${KAFKA_GROUP_ID}
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${OAUTH2_ISSUER_URI}

logging:
  level:
    root: ${LOGGING_LEVEL_ROOT:INFO}
    com.openframe: ${LOGGING_LEVEL_OPENFRAME:DEBUG}
    org.springframework.security: ${LOGGING_LEVEL_SPRING_SECURITY:INFO}
    org.springframework.web: DEBUG
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env
  endpoint:
    health:
      show-details: always

openframe:
  security:
    jwt:
      secret-key: ${JWT_SECRET_KEY}
    encryption:
      secret-key: ${ENCRYPTION_SECRET_KEY}
  
  database:
    mongodb:
      database: openframe-dev
    
  external:
    fleet-mdm:
      api-url: ${FLEET_MDM_API_URL:}
      api-token: ${FLEET_MDM_API_TOKEN:}
    tactical-rmm:
      api-url: ${TACTICAL_RMM_API_URL:}
      api-token: ${TACTICAL_RMM_API_TOKEN:}
```

### Load Environment Variables

Create helper scripts:

#### `scripts/dev-env.sh`

```bash
#!/bin/bash

# Load development environment variables
if [ -f .env.dev ]; then
  export $(cat .env.dev | grep -v '#' | awk '/=/ {print $1}')
  echo "✅ Development environment variables loaded"
else
  echo "❌ .env.dev file not found"
  exit 1
fi

# Verify critical variables
if [ -z "$MONGODB_URI" ]; then
  echo "❌ MONGODB_URI not set"
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "❌ REDIS_URL not set"  
  exit 1
fi

echo "🚀 Environment ready for development"
```

#### `scripts/start-dev.sh`

```bash
#!/bin/bash

# Start development environment
echo "🚀 Starting OpenFrame OSS Lib development environment..."

# Load environment variables
source scripts/dev-env.sh

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Verify service connectivity
echo "🔍 Verifying service connectivity..."
mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')" >/dev/null 2>&1 && echo "✅ MongoDB connected" || echo "❌ MongoDB connection failed"
redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1 && echo "✅ Redis connected" || echo "❌ Redis connection failed"

echo "🎉 Development environment ready!"
echo "📊 Kafka UI: http://localhost:8090"
echo "🗄️  MongoDB: $MONGODB_URI"
echo "🔴 Redis: $REDIS_URL"
```

Make scripts executable:

```bash
chmod +x scripts/dev-env.sh scripts/start-dev.sh
```

## Development Workflow

### Daily Development Routine

```bash
# 1. Start development environment
./scripts/start-dev.sh

# 2. Build all modules
mvn clean install -DskipTests

# 3. Run specific services as needed
cd openframe-api-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 4. Run tests
mvn test -Dtest=*Test -Dspring.profiles.active=dev
```

### Hot Reloading

Enable Spring Boot DevTools for automatic restarts:

```xml
<!-- Add to module pom.xml dependencies -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

### Debug Configuration

#### Remote Debugging

```bash
# Start service with debug port
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"

# Connect debugger to localhost:5005
```

#### Database Debugging

```bash
# Enable SQL logging in application-dev.yml
logging:
  level:
    org.springframework.data.mongodb.core: DEBUG
    org.springframework.data.redis.core: DEBUG
```

## Troubleshooting

### Common Environment Issues

#### Port Conflicts

```bash
# Check what's using a port
lsof -i :8080

# Kill process using port
kill -9 $(lsof -t -i :8080)
```

#### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"

# Test Redis connection
redis-cli -u "$REDIS_URL" ping

# Check Docker container logs
docker-compose -f docker-compose.dev.yml logs mongodb redis
```

#### Maven/Java Issues

```bash
# Clear Maven cache
rm -rf ~/.m2/repository/com/openframe

# Verify Java version
java -version
javac -version

# Check JAVA_HOME
echo $JAVA_HOME
```

### Performance Optimization

#### JVM Tuning for Development

```bash
# Add to IDE VM options or environment
-Xmx4G -Xms1G
-XX:+UseG1GC
-XX:+UseStringDeduplication
-Djava.awt.headless=true
```

#### Maven Build Optimization

```bash
# Parallel builds
mvn clean install -T 4C -DskipTests

# Skip unnecessary plugins during development
mvn compile -Dmaven.javadoc.skip=true
```

---

**Environment configured?** Continue with [Local Development Setup](local-development.md) to run the full OpenFrame stack locally.