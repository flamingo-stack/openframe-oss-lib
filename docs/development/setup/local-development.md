# Local Development Setup

This guide provides step-by-step instructions for setting up a complete local development environment for OpenFrame OSS Lib, including all services and dependencies.

## Overview

A complete OpenFrame development environment includes:

- **Core Services**: API, Gateway, Authorization services
- **Data Layer**: MongoDB, Redis, Kafka, Cassandra  
- **Development Tools**: Database GUIs, Kafka monitoring
- **External Integrations**: FleetDM, TacticalRMM SDKs (optional)

## Prerequisites

Ensure you have completed the [Environment Setup](environment.md) guide and have:

- ✅ Java 21 and Maven 3.8+ installed
- ✅ Docker and Docker Compose running
- ✅ IDE configured with required plugins
- ✅ Git repository cloned

## Full Stack Setup

### 1. Start Development Infrastructure

```bash
# Navigate to project root
cd openframe-oss-lib

# Start all infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

**Expected Services:**

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| MongoDB | 27017 | Running | Primary database |
| Redis | 6379 | Running | Caching and sessions |
| Kafka | 9092 | Running | Event streaming |
| Zookeeper | 2181 | Running | Kafka coordination |
| Cassandra | 9042 | Running | Time-series data |
| Kafka UI | 8090 | Running | Kafka management |

### 2. Configure Environment Variables

Create and load development environment:

```bash
# Create environment configuration
cat > .env.dev << EOF
# Core Database Configuration
MONGODB_URI=mongodb://admin:password@localhost:27017/openframe-dev?authSource=admin
REDIS_URL=redis://:password@localhost:6379

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CLIENT_ID=openframe-dev

# Security Configuration
JWT_SECRET_KEY=dev-jwt-secret-key-for-local-development-only
ENCRYPTION_SECRET_KEY=dev-encryption-secret-key-32-chars
RSA_PRIVATE_KEY_PATH=/tmp/openframe-dev-rsa.key

# OAuth2 Configuration
OAUTH2_ISSUER_URI=http://localhost:8082
OAUTH2_CLIENT_ID=openframe-dev-client
OAUTH2_CLIENT_SECRET=dev-client-secret-change-in-prod

# Service Ports
API_SERVICE_PORT=8080
GATEWAY_SERVICE_PORT=8081
AUTHORIZATION_SERVICE_PORT=8082
EXTERNAL_API_SERVICE_PORT=8083
MANAGEMENT_SERVICE_PORT=8084

# External Tools (Optional)
FLEET_MDM_API_URL=https://demo.fleetdm.com
TACTICAL_RMM_API_URL=https://demo.tacticalrmm.com
EOF

# Load environment variables
export $(cat .env.dev | grep -v '#' | awk '/=/ {print $1}')
```

### 3. Initialize Development Data

```bash
# Generate RSA keys for JWT signing
mkdir -p /tmp/openframe-keys
openssl genrsa -out /tmp/openframe-keys/dev-rsa.key 2048
openssl rsa -in /tmp/openframe-keys/dev-rsa.key -pubout -out /tmp/openframe-keys/dev-rsa.pub

# Initialize MongoDB with test data
mongosh "$MONGODB_URI" << EOF
use openframe-dev;

// Create development tenant
db.tenants.insertOne({
  _id: "dev-tenant-001",
  name: "Development Tenant",
  slug: "dev-tenant",
  domain: "dev.localhost",
  status: "ACTIVE",
  plan: "ENTERPRISE",
  createdAt: new Date(),
  updatedAt: new Date()
});

// Create development user
db.users.insertOne({
  _id: "dev-user-001", 
  email: "dev@openframe.local",
  firstName: "Development",
  lastName: "User",
  tenantId: "dev-tenant-001",
  roles: ["OWNER"],
  status: "ACTIVE",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Create OAuth2 client
db.oauthClients.insertOne({
  _id: "openframe-dev-client",
  clientId: "openframe-dev-client", 
  clientSecret: "dev-client-secret-change-in-prod",
  tenantId: "dev-tenant-001",
  grantTypes: ["authorization_code", "refresh_token"],
  redirectUris: ["http://localhost:3000/auth/callback"],
  scopes: ["read", "write"],
  createdAt: new Date(),
  updatedAt: new Date()
});

EOF
```

### 4. Build All Modules

```bash
# Clean build all modules
mvn clean install -DskipTests

# Build with tests (optional, takes longer)
mvn clean install
```

### 5. Start Core Services

Open separate terminal windows/tabs for each service:

#### Terminal 1: Authorization Service

```bash
cd openframe-authorization-service-core

# Run authorization service
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8082" \
  -Dspring-boot.run.jvmArguments="-Xmx1G"
```

**Wait for startup completion** (look for "Started AuthorizationServiceApplication"):

```text
2024-01-20 10:00:00.000  INFO 12345 --- [main] c.o.a.AuthorizationServiceApplication : Started AuthorizationServiceApplication in 15.234 seconds
```

#### Terminal 2: API Service Core

```bash
cd openframe-api-service-core

# Run API service
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8080" \
  -Dspring-boot.run.jvmArguments="-Xmx2G"
```

#### Terminal 3: Gateway Service

```bash
cd openframe-gateway-service-core

# Run gateway service
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8081" \
  -Dspring-boot.run.jvmArguments="-Xmx1G"
```

#### Terminal 4: External API Service

```bash
cd openframe-external-api-service-core

# Run external API service
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8083" \
  -Dspring-boot.run.jvmArguments="-Xmx1G"
```

### 6. Verify Services Are Running

```bash
# Check service health endpoints
curl http://localhost:8080/actuator/health  # API Service
curl http://localhost:8081/actuator/health  # Gateway Service  
curl http://localhost:8082/actuator/health  # Authorization Service
curl http://localhost:8083/actuator/health  # External API Service

# Check database connections
curl http://localhost:8080/actuator/health | jq '.components.mongo.status'
curl http://localhost:8080/actuator/health | jq '.components.redis.status'
```

## Development Workflow

### Running Tests

#### Unit Tests
```bash
# Run all unit tests
mvn test -Dspring.profiles.active=dev

# Run specific module tests
mvn test -pl openframe-api-service-core -Dtest=*Test

# Run specific test class
mvn test -Dtest=OrganizationServiceTest
```

#### Integration Tests
```bash
# Run integration tests (requires running services)
mvn test -Dtest=*IntegrationTest -Dspring.profiles.active=dev

# Run API integration tests
cd openframe-test-service-core
mvn test -Dtest=*Test -Dspring.profiles.active=dev
```

### API Testing

#### GraphQL API Testing

```bash
# Test GraphQL endpoint
curl -X POST http://localhost:8081/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "{ organizations { edges { node { id name } } } }"
  }'
```

#### REST API Testing

```bash
# Test internal REST API (via Gateway)
curl -X GET http://localhost:8081/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test external REST API (direct)
curl -X GET http://localhost:8083/api/v1/devices \
  -H "X-API-Key: YOUR_API_KEY"
```

### Hot Reloading

Enable automatic restart on code changes:

```bash
# Add spring-boot-devtools dependency to relevant modules
# Already included in development profiles

# Run with devtools active
mvn spring-boot:run -Dspring-boot.run.profiles=dev,devtools
```

### Database Management

#### MongoDB Operations

```bash
# Connect to development database
mongosh "$MONGODB_URI"

# Useful queries
use openframe-dev;
db.tenants.find({});
db.users.find({});
db.organizations.find({});
db.devices.find({});

# Clear test data
db.devices.deleteMany({});
db.events.deleteMany({});
```

#### Redis Operations

```bash
# Connect to Redis
redis-cli -u "$REDIS_URL"

# Check cached data
KEYS openframe:dev:*
GET openframe:dev:user:dev-user-001
FLUSHDB  # Clear development cache
```

#### Kafka Operations

```bash
# List topics
kafka-topics.sh --bootstrap-server localhost:9092 --list

# Create development topic
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic openframe-dev-events \
  --partitions 3 --replication-factor 1

# Consume messages
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic openframe-dev-events --from-beginning
```

### Stream Processing Development

#### Start Stream Processing Service

```bash
cd openframe-stream-service-core

# Run with Kafka connectivity
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8085"
```

#### Test Event Processing

```bash
# Publish test event to Kafka
kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic openframe-integrated-tool-events

# Send test message (paste and press Enter)
{"id":"test-001","toolType":"FLEET_MDM","eventType":"HOST_ACTIVITY","tenantId":"dev-tenant-001","data":{"hostId":"dev-host-001","activity":"login"}}
```

### Agent Development

#### Start Client Core Service

```bash
cd openframe-client-core

# Run agent management service
mvn spring-boot:run \
  -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.arguments="--server.port=8086"
```

#### Test Agent Registration

```bash
# Register a test agent
curl -X POST http://localhost:8086/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "machineId": "dev-machine-001",
    "agentId": "dev-agent-001", 
    "toolType": "FLEET_MDM",
    "tenantId": "dev-tenant-001",
    "registrationSecret": "dev-registration-secret"
  }'
```

## Advanced Development Setup

### External Tool Integration

#### FleetDM Integration (Optional)

```bash
# Set FleetDM configuration
export FLEET_MDM_API_URL="https://your-fleet-instance.com"
export FLEET_MDM_API_TOKEN="your-fleet-api-token"

# Test FleetDM SDK
cd sdk/fleetmdm
mvn test -Dtest=FleetMdmClientTest
```

#### TacticalRMM Integration (Optional)

```bash
# Set TacticalRMM configuration  
export TACTICAL_RMM_API_URL="https://your-tactical-instance.com"
export TACTICAL_RMM_API_TOKEN="your-tactical-api-token"

# Test TacticalRMM SDK
cd sdk/tacticalrmm
mvn test -Dtest=TacticalRmmClientTest
```

### Development Utilities

#### Database Seeding

```bash
# Run test data generators
cd openframe-test-service-core

# Generate test organizations
mvn exec:java -Dexec.mainClass="com.openframe.test.data.generator.OrganizationGenerator"

# Generate test devices  
mvn exec:java -Dexec.mainClass="com.openframe.test.data.generator.DeviceGenerator"

# Generate test logs
mvn exec:java -Dexec.mainClass="com.openframe.test.data.generator.LogGenerator"
```

#### Performance Testing

```bash
# Install Apache Bench for load testing
apt-get install apache2-utils  # Ubuntu
brew install httpie            # macOS

# Load test API endpoints
ab -n 1000 -c 10 http://localhost:8081/actuator/health

# Test with authentication
ab -n 100 -c 5 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   http://localhost:8081/api/organizations
```

### Debugging and Troubleshooting

#### Service Startup Issues

```bash
# Check service logs
tail -f logs/application.log

# Check port conflicts
netstat -tulpn | grep 808[0-9]
lsof -i :8080

# Debug JVM issues
jps -v  # List Java processes
jstack PID  # Thread dump for stuck processes
```

#### Database Connection Issues

```bash
# Test connectivity
mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"
redis-cli -u "$REDIS_URL" ping

# Check Docker container health
docker-compose -f docker-compose.dev.yml logs mongodb redis kafka

# Restart problematic services
docker-compose -f docker-compose.dev.yml restart mongodb redis
```

#### Memory and Performance Issues

```bash
# Monitor JVM memory usage
jstat -gc PID 1s

# Java Flight Recorder (for detailed profiling)
java -XX:+FlightRecorder \
     -XX:StartFlightRecording=duration=60s,filename=openframe-profile.jfr \
     -jar target/openframe-api-service-core.jar

# Analyze heap dumps
jcmd PID GC.run_finalization
jcmd PID VM.gc
```

### Multi-Service Development Scripts

Create `scripts/dev-full-stack.sh`:

```bash
#!/bin/bash

echo "🚀 Starting OpenFrame OSS Lib Full Development Stack"

# Start infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Wait for services
echo "⏳ Waiting for infrastructure services..."
sleep 30

# Start core services in background with logging
echo "🔧 Starting Authorization Service..."
cd openframe-authorization-service-core
mvn spring-boot:run -Dspring.profiles.active=dev > ../logs/auth-service.log 2>&1 &
AUTH_PID=$!

echo "🔧 Starting API Service..."
cd ../openframe-api-service-core  
mvn spring-boot:run -Dspring.profiles.active=dev > ../logs/api-service.log 2>&1 &
API_PID=$!

echo "🔧 Starting Gateway Service..."
cd ../openframe-gateway-service-core
mvn spring-boot:run -Dspring.profiles.active=dev > ../logs/gateway-service.log 2>&1 &
GATEWAY_PID=$!

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 45

# Health checks
echo "🔍 Checking service health..."
curl -f http://localhost:8082/actuator/health && echo "✅ Authorization Service" || echo "❌ Authorization Service"
curl -f http://localhost:8080/actuator/health && echo "✅ API Service" || echo "❌ API Service"  
curl -f http://localhost:8081/actuator/health && echo "✅ Gateway Service" || echo "❌ Gateway Service"

echo "🎉 Development stack ready!"
echo "📊 Kafka UI: http://localhost:8090"
echo "🌐 Gateway: http://localhost:8081"
echo "🔐 Auth Server: http://localhost:8082"
echo "📡 API Service: http://localhost:8080"

# Cleanup function
cleanup() {
  echo "🛑 Stopping services..."
  kill $AUTH_PID $API_PID $GATEWAY_PID 2>/dev/null
  docker-compose -f docker-compose.dev.yml down
  exit
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
```

Make it executable and run:

```bash
chmod +x scripts/dev-full-stack.sh
./scripts/dev-full-stack.sh
```

## Next Steps

With your local development environment running, you can:

1. **[Explore Architecture](../architecture/README.md)** - Understand system design
2. **[Security Implementation](../security/README.md)** - Learn authentication patterns  
3. **[Testing Strategies](../testing/README.md)** - Write comprehensive tests
4. **[Contributing Guidelines](../contributing/guidelines.md)** - Submit your first contribution

---

**Development environment ready?** Continue with [Architecture Overview](../architecture/README.md) to understand how all the components work together.