# Local Development Guide

Learn the development workflow for building applications with OpenFrame OSS Library, including hot reload, debugging, and testing workflows.

## Clone and Setup Commands

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/openframe-project.git
cd openframe-project

# Create development branch
git checkout -b feature/my-new-feature

# Install dependencies
./mvnw clean install

# Verify setup
./mvnw spring-boot:run
```

### Project Structure

```text
openframe-project/
├── src/
│   ├── main/
│   │   ├── java/com/openframe/
│   │   │   ├── config/          # Configuration classes
│   │   │   ├── controller/      # REST controllers
│   │   │   ├── service/         # Business logic
│   │   │   ├── repository/      # Data access layer
│   │   │   ├── model/          # Domain models
│   │   │   └── Application.java # Main application class
│   │   └── resources/
│   │       ├── application.yml  # Configuration
│   │       ├── application-dev.yml # Development config
│   │       └── static/         # Static resources
│   └── test/
│       ├── java/               # Unit and integration tests
│       └── resources/          # Test resources
├── docker/                     # Docker configurations
├── scripts/                    # Development scripts
├── docs/                      # Project documentation
├── pom.xml                    # Maven configuration
└── README.md                  # Project README
```

## Running Locally

### Development Database Setup

#### Option 1: Docker Compose (Recommended)

Create `docker/docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: openframe-mongo-dev
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: openframe_dev
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: devpassword
    volumes:
      - mongodb_dev:/data/db
      - ../scripts/mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro

  redis:
    image: redis:7.0-alpine
    container_name: openframe-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_dev:/data
    command: redis-server --appendonly yes

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: openframe-kafka-dev
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper
    volumes:
      - kafka_dev:/var/lib/kafka/data

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: openframe-zookeeper-dev
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_dev:/var/lib/zookeeper/data

volumes:
  mongodb_dev:
  redis_dev:
  kafka_dev:
  zookeeper_dev:
```

Start development environment:

```bash
# Start all services
docker-compose -f docker/docker-compose.dev.yml up -d

# Check services status
docker-compose -f docker/docker-compose.dev.yml ps

# View logs
docker-compose -f docker/docker-compose.dev.yml logs -f mongodb
```

#### Option 2: Local Services

```bash
# Start MongoDB
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Start Redis (optional)
sudo systemctl start redis  # Linux
brew services start redis  # macOS

# Verify services
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
redis-cli ping
```

### Application Configuration

Create `src/main/resources/application-dev.yml`:

```yaml
spring:
  profiles:
    active: dev
  
  # Database Configuration
  data:
    mongodb:
      uri: mongodb://root:devpassword@localhost:27017/openframe_dev?authSource=admin
      auto-index-creation: true
  
  # Redis Configuration
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2000ms
  
  # Kafka Configuration (optional)
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: openframe-dev
      auto-offset-reset: earliest
  
  # Development Features
  devtools:
    restart:
      enabled: true
      poll-interval: 1000ms
      quiet-period: 400ms
    livereload:
      enabled: true

# OpenFrame Configuration
openframe:
  security:
    jwt:
      secret: development-jwt-secret-for-local-development-only-32chars
      expiration: 86400 # 24 hours
      refresh-expiration: 604800 # 7 days
    oauth:
      enabled: false # Disable OAuth for local development
  
  # Cache Configuration
  cache:
    enabled: true
    ttl: 3600 # 1 hour
  
  # Pagination Defaults
  pagination:
    default-size: 20
    max-size: 100

# Logging Configuration
logging:
  level:
    root: INFO
    com.openframe: DEBUG
    org.springframework.security: DEBUG
    org.mongodb.driver: INFO
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"

# Management Endpoints
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,configprops,beans
  endpoint:
    health:
      show-details: always
  health:
    mongo:
      enabled: true
    redis:
      enabled: true
```

### Running the Application

#### Option 1: Maven Spring Boot Plugin

```bash
# Run with development profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Run with JVM options
./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Xmx1g -Xdebug"

# Run with environment variables
MONGODB_URI=mongodb://localhost:27017/custom_db ./mvnw spring-boot:run
```

#### Option 2: IDE Integration

**IntelliJ IDEA Run Configuration:**

```text
Main class: com.openframe.Application
VM options: -Dspring.profiles.active=dev -Xmx1024m
Environment variables: 
  SPRING_PROFILES_ACTIVE=dev
  MONGODB_URI=mongodb://localhost:27017/openframe_dev
Working directory: $MODULE_WORKING_DIR$
Use classpath of module: openframe-project
```

**VS Code Launch Configuration (`.vscode/launch.json`):**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "OpenFrame Development",
      "request": "launch",
      "mainClass": "com.openframe.Application",
      "projectName": "openframe-project",
      "env": {
        "SPRING_PROFILES_ACTIVE": "dev",
        "MONGODB_URI": "mongodb://localhost:27017/openframe_dev"
      },
      "vmArgs": "-Dspring.profiles.active=dev -Xmx1024m",
      "console": "integratedTerminal"
    }
  ]
}
```

## Hot Reload / Watch Mode

### Spring Boot DevTools

DevTools provides automatic restart and live reload capabilities.

**Configuration in `application-dev.yml`:**

```yaml
spring:
  devtools:
    restart:
      enabled: true
      additional-paths: src/main/java,src/main/resources
      exclude: static/**,templates/**
      poll-interval: 1000ms
      quiet-period: 400ms
    livereload:
      enabled: true
      port: 35729
```

### File Watching Workflow

```mermaid
flowchart LR
    A[Edit Code] --> B[Save File]
    B --> C[DevTools Detects Change]
    C --> D[Restart Application]
    D --> E[Live Reload Browser]
    E --> F[Test Changes]
    F --> A
```

### IDE-Specific Hot Reload

**IntelliJ IDEA:**

1. Enable automatic compilation:
   - `File > Settings > Build, Execution, Deployment > Compiler`
   - Check "Build project automatically"

2. Enable automatic make:
   - `File > Settings > Advanced Settings`
   - Check "Allow auto-make to start even if developed application is currently running"

**VS Code:**

Hot reload works automatically when files are saved with Spring Boot DevTools enabled.

### Testing Hot Reload

1. **Start the application** with DevTools enabled
2. **Make a change** to a controller or service
3. **Save the file** - DevTools will restart the application
4. **Test the API** to verify changes

Example test:

```bash
# Make change to controller
# Save file
# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/devices
```

## Debug Configuration

### Application Debugging

#### Enable Debug Mode

**Maven:**
```bash
# Run with debug port 5005
./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"
```

**IDE Debug Run:**

**IntelliJ IDEA:**
1. Set breakpoints in your code
2. Run > Debug 'Application' 
3. Application starts in debug mode

**VS Code:**
1. Set breakpoints by clicking line numbers
2. Press `F5` or use Debug panel
3. Select "OpenFrame Development" configuration

#### Remote Debugging

For debugging deployed applications:

```bash
# Start application with debug agent
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 \
  -jar target/openframe-project.jar
```

**IDE Remote Debug Setup:**
```text
Host: localhost (or remote server IP)
Port: 5005
Transport: Socket
Debugger mode: Attach
```

### Database Debugging

#### MongoDB Query Logging

Enable MongoDB query logging in `application-dev.yml`:

```yaml
logging:
  level:
    org.springframework.data.mongodb.core.MongoTemplate: DEBUG
    org.springframework.data.mongodb.repository: DEBUG
```

#### Redis Monitoring

```bash
# Monitor Redis commands
redis-cli monitor

# View Redis info
redis-cli info

# List all keys
redis-cli keys "*"
```

### HTTP Request Debugging

#### Enable Request Logging

```yaml
logging:
  level:
    org.springframework.web: DEBUG
    org.springframework.security: DEBUG
    org.apache.http: DEBUG
```

#### Use HTTP Client Tools

**cURL Examples:**
```bash
# GET request with headers
curl -v \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/api/devices

# POST request with JSON body
curl -v -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Device", "type": "LAPTOP"}' \
  http://localhost:8080/api/devices
```

**HTTPie (user-friendly alternative):**
```bash
# Install HTTPie
pip install httpie

# GET request
http GET localhost:8080/api/devices Authorization:"Bearer $JWT_TOKEN"

# POST request  
http POST localhost:8080/api/devices \
  Authorization:"Bearer $JWT_TOKEN" \
  name="Test Device" \
  type="LAPTOP"
```

## Development Scripts

Create useful development scripts in `scripts/` directory:

### Database Management Scripts

**`scripts/reset-db.sh`:**
```bash
#!/bin/bash
echo "Resetting development database..."

# Drop development database
mongosh openframe_dev --eval "db.dropDatabase()"

# Clear Redis cache
redis-cli FLUSHALL

# Restart application to trigger database initialization
echo "Database reset complete. Restart your application."
```

**`scripts/seed-data.sh`:**
```bash
#!/bin/bash
echo "Seeding development data..."

# Create sample organization
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "name": "Development Org",
    "slug": "dev-org",
    "contactInformation": {
      "email": "dev@example.com"
    }
  }'

# Create sample devices
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/devices \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d "{
      \"machineId\": \"dev-device-$i\",
      \"serialNumber\": \"DEV$i\",
      \"model\": \"Development Device $i\",
      \"type\": \"DESKTOP\"
    }"
done

echo "Sample data created successfully!"
```

### Development Workflow Scripts

**`scripts/dev-start.sh`:**
```bash
#!/bin/bash
echo "Starting OpenFrame development environment..."

# Start Docker services
docker-compose -f docker/docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for MongoDB to be ready..."
until mongosh --eval "print('MongoDB is ready')" > /dev/null 2>&1; do
  sleep 2
done

echo "Waiting for Redis to be ready..."
until redis-cli ping > /dev/null 2>&1; do
  sleep 2
done

echo "Services are ready! Starting application..."
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**`scripts/dev-stop.sh`:**
```bash
#!/bin/bash
echo "Stopping OpenFrame development environment..."

# Stop Docker services
docker-compose -f docker/docker-compose.dev.yml down

echo "Development environment stopped."
```

### Testing Scripts

**`scripts/run-tests.sh`:**
```bash
#!/bin/bash
echo "Running OpenFrame tests..."

# Unit tests
echo "Running unit tests..."
./mvnw test

# Integration tests
echo "Running integration tests..."
./mvnw verify -P integration-tests

# API tests
echo "Running API tests..."
./mvnw test -Dtest="**/*ApiTest"

echo "All tests completed!"
```

## Common Development Tasks

### Adding New Features

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/device-filtering
   ```

2. **Implement Feature:**
   - Add/modify controllers
   - Update services and repositories
   - Create/update DTOs
   - Add tests

3. **Test Locally:**
   ```bash
   ./mvnw test
   curl http://localhost:8080/api/devices?filter=active
   ```

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat: add device filtering capability"
   ```

### Working with Database Changes

1. **MongoDB Schema Changes:**
   - Update document models
   - Create migration scripts if needed
   - Update indexes

2. **Test Migration:**
   ```bash
   # Reset database
   ./scripts/reset-db.sh
   
   # Start application (triggers auto-indexing)
   ./mvnw spring-boot:run
   
   # Verify indexes
   mongosh openframe_dev --eval "db.devices.getIndexes()"
   ```

### API Development Workflow

1. **Design API Endpoint:**
   ```java
   @GetMapping("/api/devices/{id}/health")
   public DeviceHealthResponse getDeviceHealth(@PathVariable String id) {
       // Implementation
   }
   ```

2. **Test with curl:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/devices/device-123/health
   ```

3. **Add Integration Test:**
   ```java
   @Test
   public void testGetDeviceHealth() {
       // Test implementation
   }
   ```

## Troubleshooting Common Issues

### Application Won't Start

**Check Database Connection:**
```bash
# Test MongoDB connection
mongosh --eval "db.runCommand({ connectionStatus: 1 })"

# Check application logs
tail -f target/spring.log
```

### Hot Reload Not Working

**IntelliJ IDEA:**
1. Verify "Build project automatically" is enabled
2. Check that DevTools is in classpath
3. Try `Build > Rebuild Project`

**VS Code:**
1. Restart Java Language Server: `Ctrl+Shift+P` > "Java: Reload Projects"
2. Check that DevTools is properly configured

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080
netstat -tulpn | grep :8080

# Kill the process
kill -9 PID

# Or use a different port
SERVER_PORT=8081 ./mvnw spring-boot:run
```

### Database Connection Issues

**MongoDB Authentication:**
```bash
# Test connection with credentials
mongosh "mongodb://root:devpassword@localhost:27017/openframe_dev?authSource=admin"
```

**Check Docker Services:**
```bash
# View service logs
docker-compose -f docker/docker-compose.dev.yml logs mongodb

# Restart services
docker-compose -f docker/docker-compose.dev.yml restart
```

## Performance Optimization

### JVM Tuning for Development

```bash
# Optimized JVM settings for development
export JAVA_OPTS="-Xms512m -Xmx2g -XX:+UseG1GC -XX:+UseStringDeduplication"
./mvnw spring-boot:run
```

### Database Performance

**MongoDB Indexes:**
```bash
# Create compound index for common queries
mongosh openframe_dev --eval "
  db.devices.createIndex({ 
    'organizationId': 1, 
    'status': 1, 
    'lastCheckin': -1 
  })
"
```

**Redis Cache Configuration:**
```yaml
spring:
  cache:
    redis:
      time-to-live: 3600000 # 1 hour
      cache-null-values: false
```

## Next Steps

Your local development environment is ready! Continue with:

1. **[Architecture Overview](../architecture/overview.md)** - Understand system design
2. **[Testing Overview](../testing/overview.md)** - Learn testing strategies
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Contribute to the project

## Support & Resources

- 💬 **Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 📚 **Documentation**: [Development Guide](../README.md)
- 🚀 **Platform**: [OpenFrame.ai](https://openframe.ai)

Happy developing with OpenFrame! 🚀