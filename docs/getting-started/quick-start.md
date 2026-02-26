# Quick Start Guide

Get OpenFrame OSS Libraries up and running in just 5 minutes! This guide walks you through cloning, building, and running the core services with minimal configuration.

## TL;DR - 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Start dependencies with Docker
docker-compose up -d

# 3. Build the project
mvn clean install -DskipTests

# 4. Run a sample service
cd openframe-api-service-core
mvn spring-boot:run
```

## Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

**What you get:**
- Complete OpenFrame OSS Libraries source code
- Multi-module Maven project structure
- Sample configurations and documentation

### Step 2: Start Infrastructure Dependencies

Create a `docker-compose.yml` file for quick dependency setup:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7-jammy
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=openframe
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

volumes:
  mongo_data:
  redis_data:
```

Start the services:

```bash
docker-compose up -d
```

**Verification:**
```bash
# Check all services are running
docker-compose ps

# Test connections
mongosh --eval "db.adminCommand('ping')"
redis-cli ping
```

### Step 3: Build the Project

Build all modules with Maven:

```bash
mvn clean install -DskipTests
```

**Expected output:**
```text
[INFO] Reactor Summary for OpenFrame OSS Libraries:
[INFO] 
[INFO] openframe-core ..................................... SUCCESS
[INFO] openframe-data-mongo ............................... SUCCESS
[INFO] openframe-api-lib .................................. SUCCESS
[INFO] openframe-security-core ............................ SUCCESS
[INFO] openframe-api-service-core ......................... SUCCESS
[INFO] ... (other modules)
[INFO] BUILD SUCCESS
```

> **Note**: We skip tests initially to speed up the first build. Run tests later with `mvn test`.

### Step 4: Configure Environment

Create an `application.yml` file in your working directory:

```yaml
# Basic configuration for quick start
spring:
  profiles:
    active: development
  
  # MongoDB Configuration
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe
  
  # Redis Configuration
  data:
    redis:
      host: localhost
      port: 6379
  
  # Kafka Configuration
  kafka:
    bootstrap-servers: localhost:9092
    
# Security Configuration
openframe:
  security:
    jwt:
      secret: development-secret-key-change-in-production
  oauth:
    encryption-key: dev-key-32-chars-long-minimum!!

# Server Configuration
server:
  port: 8080

# Logging
logging:
  level:
    com.openframe: DEBUG
    org.springframework.security: DEBUG
```

### Step 5: Run the API Service

Start the main API service:

```bash
cd openframe-api-service-core
mvn spring-boot:run
```

**Expected startup logs:**
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
Started ApiServiceApplication in 12.34 seconds
```

The service will be available at `http://localhost:8080`.

## Verify Your Installation

### Test the Health Endpoint

```bash
curl http://localhost:8080/health
```

**Expected response:**
```json
{
  "status": "OK"
}
```

### Explore the GraphQL Schema

Visit the GraphQL Playground:
```
http://localhost:8080/graphiql
```

Try a sample query:
```graphql
query {
  __schema {
    types {
      name
      description
    }
  }
}
```

### Test Authentication Setup

Check the OAuth2 configuration endpoint:
```bash
curl http://localhost:8080/.well-known/openid-configuration
```

You should see a JSON response with OAuth2/OIDC discovery information.

## Available Endpoints

With the API service running, you have access to:

| Endpoint | Type | Description |
|----------|------|-------------|
| `/health` | REST | Service health check |
| `/graphql` | GraphQL | Main data API |
| `/graphiql` | Web UI | GraphQL playground |
| `/api/users` | REST | User management |
| `/api/organizations` | REST | Organization management |
| `/oauth/token` | OAuth2 | Token endpoint |
| `/.well-known/openid-configuration` | OIDC | Discovery document |

## What's Running?

After completing the quick start, you have:

### **Infrastructure Services**
- ✅ MongoDB (port 27017) - Primary database
- ✅ Redis (port 6379) - Caching and sessions  
- ✅ Kafka (port 9092) - Event streaming
- ✅ Zookeeper (port 2181) - Kafka coordination

### **OpenFrame Services**
- ✅ API Service Core (port 8080) - Main application API
- ✅ OAuth2 Authorization Server - Multi-tenant authentication
- ✅ GraphQL API - Efficient data queries
- ✅ REST APIs - Administrative operations

## Sample Data Operations

### Create an Organization

```bash
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample MSP",
    "contactInformation": {
      "email": "admin@samplemsp.com",
      "phone": "+1-555-0123"
    }
  }'
```

### Query via GraphQL

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { organizations { edges { node { id name } } } }"
  }'
```

## Performance Tips

For better development performance:

```bash
# Use parallel builds
mvn clean install -T 4

# Skip non-essential plugins
mvn clean install -DskipTests -Dcheckstyle.skip

# Increase Maven memory
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"
```

## Troubleshooting

### Build Issues

**"Java version not supported"**
```bash
java -version  # Ensure Java 21+
echo $JAVA_HOME  # Verify JAVA_HOME
```

**"Tests failing"**
```bash
# Skip tests initially
mvn clean install -DskipTests
```

### Connection Issues

**MongoDB connection refused**
```bash
# Check Docker container
docker-compose ps
docker-compose logs mongodb
```

**Port conflicts**
```bash
# Check what's using the ports
lsof -i :8080
lsof -i :27017
```

### Memory Issues

**OutOfMemoryError during build**
```bash
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=1g"
```

## Next Steps

Congratulations! You now have OpenFrame OSS Libraries running locally. 

Continue your journey:

1. **[First Steps Guide](first-steps.md)** - Explore key features and capabilities
2. **[Development Setup](../development/setup/local-development.md)** - Configure your development environment
3. **[Architecture Overview](../development/architecture/README.md)** - Understand the system design

## Getting Help

If you encounter issues:

- Check our [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- Review the [Prerequisites](prerequisites.md) guide
- Browse the [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)

---

*Happy coding! You're now ready to explore the full power of OpenFrame OSS Libraries.*