# Local Development Setup

This guide will get you running the complete OpenFrame OSS Library locally with all dependencies, services, and development tools. By the end, you'll have a fully functional local development environment that mirrors the production setup.

[![OpenFrame v0.3.7 - Enhanced Developer Experience](https://img.youtube.com/vi/O8hbBO5Mym8/maxresdefault.jpg)](https://www.youtube.com/watch?v=O8hbBO5Mym8)

## 🎯 What You'll Accomplish

- **Clone and build** the complete OpenFrame OSS Library
- **Set up local services** (MongoDB, message queues, etc.)
- **Configure development databases** with sample data
- **Enable hot reload** for rapid development
- **Set up debugging** with IDE integration

## 📋 Prerequisites

Before starting, ensure you have completed:
- ✅ [Prerequisites](../../getting-started/prerequisites.md) - Java, Maven, Git installed
- ✅ [Environment Setup](environment.md) - IDE configured with necessary plugins

## 🚀 Step 1: Clone and Initial Setup

### Clone the Repository

```bash
# Clone the main repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# Check the project structure
ls -la
```

**Expected Project Structure:**
```text
openframe-oss-lib/
├── openframe-api-lib/              # Core DTOs and service interfaces
├── openframe-api-service-core/     # Main API service implementation
├── openframe-authorization-service-core/ # OAuth2 and SSO services
├── openframe-client-core/          # Client/agent communication
├── openframe-core/                 # Shared utilities and validation
├── openframe-data-mongo/           # MongoDB models and repositories
├── openframe-data/                 # Data layer abstractions
├── openframe-gateway-service-core/ # API gateway and routing
├── openframe-security-core/        # Security utilities
├── sdk/                            # Integration SDKs (TacticalRMM, Fleet MDM)
├── pom.xml                         # Root Maven configuration
├── docker-compose.yml              # Local services configuration
└── README.md                       # Project documentation
```

### Initial Build

```bash
# Clean and build all modules (this may take 5-10 minutes on first run)
mvn clean install

# If you encounter test failures during initial setup, skip tests
mvn clean install -DskipTests

# Verify build success
echo "Build Status: $?"  # Should print "Build Status: 0"
```

## 🐳 Step 2: Set Up Local Services

OpenFrame uses several services that need to be running for full functionality.

### Start Core Services with Docker Compose

```bash
# Start all required services
docker-compose up -d

# This starts:
# - MongoDB (primary database)
# - Redis (caching and sessions) 
# - NATS (message streaming)
# - Kafka (event processing)
```

### Verify Services

```bash
# Check all services are running
docker-compose ps

# Expected output:
# NAME                          STATUS
# openframe-mongodb            Up
# openframe-redis              Up  
# openframe-nats               Up
# openframe-kafka              Up
# openframe-zookeeper         Up

# Test MongoDB connection
mongosh mongodb://localhost:27017/openframe-dev --eval "db.adminCommand('ping')"

# Test Redis connection  
redis-cli ping
```

### Alternative: Individual Service Setup

If you prefer not to use Docker Compose:

<details>
<summary><strong>Click to expand individual service setup</strong></summary>

**MongoDB**
```bash
# Option 1: Docker
docker run --name openframe-mongo -p 27017:27017 -d mongo:7

# Option 2: Local installation (macOS)
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Option 3: Local installation (Ubuntu)
sudo apt install -y mongodb
sudo systemctl start mongodb
```

**Redis (Optional - for caching)**
```bash
# Option 1: Docker
docker run --name openframe-redis -p 6379:6379 -d redis:7-alpine

# Option 2: Local installation (macOS)
brew install redis
brew services start redis

# Option 3: Local installation (Ubuntu)
sudo apt install -y redis-server
sudo systemctl start redis
```

</details>

## 🗄️ Step 3: Database Initialization

### Initialize MongoDB with Development Data

Create initialization script `scripts/init-dev-db.js`:

```javascript
// MongoDB initialization script for development
use('openframe-dev');

// Create collections with sample data
db.organizations.insertMany([
    {
        _id: ObjectId(),
        name: "Demo MSP Company",
        slug: "demo-msp-company",
        website: "https://demo-msp.com",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: ObjectId(),
        name: "Local Test Organization", 
        slug: "local-test-org",
        website: "https://test-org.local",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

db.devices.insertMany([
    {
        _id: ObjectId(),
        name: "DEV-WORKSTATION-01",
        deviceType: "DESKTOP",
        status: "ONLINE",
        organizationId: db.organizations.findOne({name: "Demo MSP Company"})._id,
        tags: ["development", "windows"],
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: ObjectId(), 
        name: "DEV-SERVER-01",
        deviceType: "SERVER",
        status: "ONLINE",
        organizationId: db.organizations.findOne({name: "Demo MSP Company"})._id,
        tags: ["development", "linux", "docker"],
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print("✅ Development database initialized successfully");
print("Organizations:", db.organizations.countDocuments());
print("Devices:", db.devices.countDocuments());
```

Run the initialization:
```bash
# Execute the initialization script
mongosh mongodb://localhost:27017 --file scripts/init-dev-db.js

# Verify data was created
mongosh mongodb://localhost:27017/openframe-dev --eval "
    print('Organizations:', db.organizations.countDocuments());
    print('Devices:', db.devices.countDocuments());
"
```

## 🔧 Step 4: Configure Development Properties

### Application Configuration

Create `application-development.yml`:

```yaml
# Development-specific configuration
spring:
  profiles:
    active: development
    
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe-dev
      
  redis:
    host: localhost
    port: 6379
    timeout: 2000ms
    
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      retries: 3
      batch-size: 16384
      
  security:
    oauth2:
      client:
        registration:
          openframe:
            client-id: openframe-dev
            client-secret: dev-secret
            scope: openid,profile,email

# Logging configuration for development
logging:
  level:
    com.openframe: DEBUG
    org.springframework.data.mongodb: DEBUG
    org.springframework.web: DEBUG
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"

# Development-specific settings
openframe:
  development:
    hot-reload: true
    debug-mode: true
    sample-data: true
    
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,beans,env
  endpoint:
    health:
      show-details: always
```

### Environment Variables for Development

Create `.env.local`:

```bash
# Development Environment Variables
SPRING_PROFILES_ACTIVE=development
MONGODB_URL=mongodb://localhost:27017/openframe-dev
REDIS_URL=redis://localhost:6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Debug configuration
DEBUG=true
LOGGING_LEVEL_COM_OPENFRAME=DEBUG

# Development flags
OPENFRAME_HOT_RELOAD=true
OPENFRAME_SAMPLE_DATA=true

# OAuth development settings
OAUTH_CLIENT_ID=openframe-dev
OAUTH_CLIENT_SECRET=dev-secret-change-in-production
```

Load environment variables:
```bash
# Load into current session
export $(cat .env.local | xargs)

# Or use direnv for automatic loading
echo "dotenv .env.local" > .envrc
direnv allow
```

## 🏃‍♂️ Step 5: Run the Application

### Start Individual Services

**Terminal 1: API Service**
```bash
cd openframe-api-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=development

# Wait for: "Started OpenFrameApiApplication in X.XXX seconds"
# API will be available at: http://localhost:8080
```

**Terminal 2: Gateway Service**
```bash
cd openframe-gateway-service-core  
mvn spring-boot:run -Dspring-boot.run.profiles=development

# Wait for: "Started OpenFrameGatewayApplication in X.XXX seconds"
# Gateway will be available at: http://localhost:8081
```

**Terminal 3: Authorization Service**
```bash
cd openframe-authorization-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=development

# Wait for: "Started OpenFrameAuthorizationApplication in X.XXX seconds"  
# Auth will be available at: http://localhost:8082
```

### Verify Services Are Running

```bash
# Check API service health
curl http://localhost:8080/actuator/health

# Check Gateway service health  
curl http://localhost:8081/actuator/health

# Check Authorization service health
curl http://localhost:8082/actuator/health

# All should return: {"status":"UP"}
```

### Test API Endpoints

```bash
# Test organization listing
curl -X GET "http://localhost:8080/api/organizations?limit=10" \
  -H "Content-Type: application/json"

# Test device listing
curl -X GET "http://localhost:8080/api/devices?limit=10" \
  -H "Content-Type: application/json"

# Expected: JSON responses with sample data
```

## ⚡ Step 6: Enable Hot Reload

### Maven Configuration for Hot Reload

Add to each service module's `pom.xml`:

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <addResources>true</addResources>
    </configuration>
</plugin>
```

### IDE Configuration

**IntelliJ IDEA**
```text
1. Settings → Build → Compiler → Build project automatically: ✅
2. Registry → compiler.automake.allow.when.app.running: ✅ 
3. Run configurations → Spring Boot → Update classes and resources: ✅
```

**VS Code**
```json
// In .vscode/settings.json
{
    "java.autobuild.enabled": true,
    "java.compile.nullAnalysis.mode": "automatic"
}
```

### Test Hot Reload

1. **Start a service** with hot reload enabled
2. **Make a code change** (e.g., modify a controller endpoint)
3. **Save the file** - changes should be automatically detected
4. **Test the endpoint** - should reflect your changes without restart

```bash
# Example: Modify a controller method and test
# The service should reload automatically
curl http://localhost:8080/your-modified-endpoint
```

## 🔍 Step 7: Set Up Debugging

### Remote Debugging Configuration

**Start services with debug enabled:**

```bash
# API Service with debug
cd openframe-api-service-core
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"

# Gateway Service with debug  
cd openframe-gateway-service-core
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5006"

# Authorization Service with debug
cd openframe-authorization-service-core
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5007"
```

**IDE Debug Configuration:**

**IntelliJ IDEA**
```text
Run → Edit Configurations → Add → Remote JVM Debug
- Name: OpenFrame API Debug
- Host: localhost  
- Port: 5005 (or 5006, 5007 for other services)
- Use module classpath: openframe-api-service-core
```

**VS Code**
```json
// Add to .vscode/launch.json
{
    "configurations": [
        {
            "type": "java",
            "name": "Debug OpenFrame API",
            "request": "attach",
            "hostName": "localhost",
            "port": 5005
        },
        {
            "type": "java", 
            "name": "Debug OpenFrame Gateway",
            "request": "attach",
            "hostName": "localhost", 
            "port": 5006
        }
    ]
}
```

### Test Debugging

1. **Set a breakpoint** in a controller method
2. **Attach debugger** from your IDE
3. **Make an API request** that hits the breakpoint
4. **Verify debugging works** - execution should pause at your breakpoint

## 📊 Step 8: Development Dashboard

Create a simple script to monitor your local environment:

```bash
#!/bin/bash
# monitor-dev-environment.sh

clear
echo "🚀 OpenFrame Development Environment Status"
echo "=========================================="

# Check services
echo "📊 Service Status:"
echo -n "MongoDB: "
if mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Down"
fi

echo -n "Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Down"
fi

# Check API endpoints
echo
echo "🔗 API Endpoint Status:"
api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/actuator/health)
if [ "$api_status" = "200" ]; then
    echo "API Service: ✅ Running (http://localhost:8080)"
else
    echo "API Service: ❌ Down"
fi

gateway_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/actuator/health) 
if [ "$gateway_status" = "200" ]; then
    echo "Gateway Service: ✅ Running (http://localhost:8081)"
else
    echo "Gateway Service: ❌ Down"
fi

auth_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/actuator/health)
if [ "$auth_status" = "200" ]; then
    echo "Auth Service: ✅ Running (http://localhost:8082)"
else
    echo "Auth Service: ❌ Down"
fi

# Database stats
echo
echo "📊 Database Status:"
org_count=$(mongosh --quiet mongodb://localhost:27017/openframe-dev --eval "db.organizations.countDocuments()")
device_count=$(mongosh --quiet mongodb://localhost:27017/openframe-dev --eval "db.devices.countDocuments()")
echo "Organizations: $org_count"
echo "Devices: $device_count"

echo
echo "🔧 Development URLs:"
echo "API Documentation: http://localhost:8080/swagger-ui.html"
echo "Health Checks: http://localhost:8080/actuator/health"
echo "Database Admin: http://localhost:8081 (if mongo-express running)"
```

Run it:
```bash
chmod +x monitor-dev-environment.sh
./monitor-dev-environment.sh
```

## ✅ Verification Checklist

Ensure your local development environment is fully functional:

- [ ] **All services start without errors**
- [ ] **Database contains sample data**
- [ ] **API endpoints respond correctly**
- [ ] **Hot reload works when you make changes**
- [ ] **Debugging connects successfully**
- [ ] **Environment monitoring script shows all green**

### Test Full Workflow

```bash
# 1. Create a new organization via API
curl -X POST "http://localhost:8080/api/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Development Org",
    "website": "https://test-dev.com"
  }'

# 2. List organizations to verify creation
curl -X GET "http://localhost:8080/api/organizations?limit=10"

# 3. Check database directly
mongosh mongodb://localhost:27017/openframe-dev --eval "
  db.organizations.find({name: 'Test Development Org'}).pretty()
"

# If all these work, your environment is properly set up!
```

## 🚨 Common Issues and Solutions

### Build Failures

```bash
# Clear Maven cache and rebuild
rm -rf ~/.m2/repository/com/openframe
mvn clean install -U

# Skip tests during development setup
mvn clean install -DskipTests

# Check for port conflicts
lsof -i :8080  # API service port
lsof -i :8081  # Gateway service port 
lsof -i :27017 # MongoDB port
```

### Service Startup Issues

```bash
# Check Java version
java -version  # Should be 17+

# Verify environment variables
echo $SPRING_PROFILES_ACTIVE  # Should be 'development'

# Check database connection
mongosh mongodb://localhost:27017 --eval "db.adminCommand('ping')"
```

### Docker Service Issues

```bash
# Restart all services
docker-compose down && docker-compose up -d

# Check service logs
docker-compose logs mongodb
docker-compose logs redis

# Remove and recreate volumes
docker-compose down -v && docker-compose up -d
```

## 🎯 What's Next?

Your local development environment is now ready! Next steps:

1. **[Explore Architecture](../architecture/overview.md)** - Understand the system design
2. **[Review Testing](../testing/overview.md)** - Learn testing patterns and run tests
3. **[Read Contributing Guidelines](../contributing/guidelines.md)** - Start contributing to the project

### Development Workflow

Now you can:
- **Make code changes** with hot reload
- **Debug issues** with IDE integration
- **Test APIs** with sample data
- **Contribute features** following the established patterns

## 🤝 Get Help

- **Issues with setup?** Join [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) `#dev-help` channel
- **Want to contribute?** Check `#contributors` channel
- **General questions?** Use `#general` channel

---

**🎉 Congratulations!** You now have a fully functional local development environment for OpenFrame OSS Library. Happy coding!