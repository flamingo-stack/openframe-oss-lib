# Development Environment Setup

This guide helps you configure the optimal development environment for working with OpenFrame OSS Libraries. We'll cover IDE setup, development tools, extensions, and productivity enhancements.

## IDE Recommendations

### IntelliJ IDEA Ultimate (Recommended)

**Why IntelliJ IDEA?**
- Excellent Spring Boot integration
- Superior Maven support
- Built-in database tools
- Advanced debugging capabilities
- Great GraphQL support

#### Installation

**Option 1: Direct Download**
- Download from [JetBrains website](https://www.jetbrains.com/idea/)
- Choose Ultimate edition for full Spring Boot support

**Option 2: JetBrains Toolbox (Recommended)**
```bash
# Download and install JetBrains Toolbox
# Manage all JetBrains tools from one place
```

#### Essential IntelliJ Plugins

Install these plugins via **File → Settings → Plugins**:

| Plugin | Purpose |
|--------|---------|
| **Spring Boot** | Spring Boot application support (usually pre-installed) |
| **Lombok** | Code generation and annotations |
| **GraphQL** | GraphQL schema and query support |
| **Database Tools and SQL** | MongoDB, Redis, and SQL support |
| **Docker** | Container management |
| **Maven Helper** | Advanced Maven operations |
| **SonarLint** | Code quality analysis |
| **GitToolBox** | Enhanced Git integration |
| **Rainbow Brackets** | Code readability |
| **Key Promoter X** | Learn keyboard shortcuts |

#### IntelliJ Configuration

**Java SDK Setup:**
1. **File → Project Structure → SDKs**
2. Add JDK 21 if not detected
3. Set project SDK to Java 21

**Maven Configuration:**
1. **File → Settings → Build → Build Tools → Maven**
2. Set Maven home directory (if custom installation)
3. Enable "Import Maven projects automatically"
4. Set JVM options: `-Xmx4g -XX:MaxMetaspaceSize=512m`

**Spring Boot Run Configuration:**
1. **Run → Edit Configurations → Add New → Spring Boot**
2. Main class: `com.openframe.api.ApiServiceApplication`
3. Working directory: `$MODULE_WORKING_DIR$`
4. VM options: `-Xmx2g -Dspring.profiles.active=development`

### Visual Studio Code (Alternative)

For developers who prefer VS Code:

#### Required Extensions

```bash
# Install via VS Code Extensions marketplace
```

| Extension | Purpose |
|-----------|---------|
| **Extension Pack for Java** | Complete Java development |
| **Spring Boot Extension Pack** | Spring Boot support |
| **GraphQL** | GraphQL syntax highlighting |
| **Docker** | Container support |
| **REST Client** | API testing |
| **Lombok Annotations Support** | Lombok integration |

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
    "java.home": "/path/to/java-21",
    "java.configuration.runtimes": [
        {
            "name": "JavaSE-21",
            "path": "/path/to/java-21"
        }
    ],
    "spring-boot.ls.java.home": "/path/to/java-21",
    "java.compile.nullAnalysis.mode": "automatic",
    "java.configuration.maven.userSettings": "~/.m2/settings.xml",
    "files.exclude": {
        "**/target": true,
        "**/.mvn": true
    }
}
```

### Eclipse with Spring Tools

For Eclipse users:

#### Installation
1. Download Eclipse IDE for Enterprise Java Developers
2. Install Spring Tools 4 from Eclipse Marketplace

#### Essential Eclipse Plugins
- Spring Tools 4
- Lombok
- Maven Integration (m2e)
- MongoDB support

## Required Development Tools

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
                <maven.compiler.source>21</maven.compiler.source>
                <maven.compiler.target>21</maven.compiler.target>
                <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            </properties>
        </profile>
    </profiles>
    
    <activeProfiles>
        <activeProfile>openframe-dev</activeProfile>
    </activeProfiles>
</settings>
```

### Git Configuration

Configure Git for the project:

```bash
# Set up Git user (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"

# Configure line endings (important for cross-platform)
git config --global core.autocrlf input

# Set up useful aliases
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.lg "log --oneline --graph --decorate"
```

## Database Tools

### MongoDB Management

**Option 1: MongoDB Compass (Recommended)**
```bash
# Download from MongoDB website
# Provides GUI for MongoDB operations
```

**Option 2: Command Line Tools**
```bash
# MongoDB Shell
mongosh

# Sample connection test
mongosh "mongodb://localhost:27017/openframe"
```

**IntelliJ Database Plugin:**
1. **View → Tool Windows → Database**
2. Add MongoDB data source
3. Connection URL: `mongodb://localhost:27017/openframe`

### Redis Management

**Option 1: RedisInsight**
```bash
# Download from Redis website
# Free GUI tool for Redis
```

**Option 2: Command Line**
```bash
# Redis CLI
redis-cli

# Test connection
redis-cli ping
```

### Kafka Management

**Option 1: Kafka UI (Docker)**
```yaml
# docker-compose.kafka-ui.yml
version: '3.8'
services:
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports:
      - "8090:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: localhost:9092
```

**Option 2: Command Line Tools**
```bash
# List topics
kafka-topics.sh --bootstrap-server localhost:9092 --list

# Consume messages
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic your-topic
```

## Development Environment Variables

Create a `.env` file in your project root:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/openframe
REDIS_URL=redis://localhost:6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Optional Analytics Databases
CASSANDRA_CONTACT_POINTS=localhost:9042
PINOT_BROKER_URL=http://localhost:8099

# Security Configuration (Development Only)
JWT_SECRET=development-secret-key-32-chars-min
OAUTH_ENCRYPTION_KEY=dev-encryption-key-32-chars-long!

# External Services
NATS_URL=nats://localhost:4222

# Logging Configuration
LOG_LEVEL=DEBUG
SQL_LOGGING=true

# Development Flags
SPRING_PROFILES_ACTIVE=development
MAVEN_OPTS=-Xmx4g -XX:MaxMetaspaceSize=512m
```

Load environment variables:

```bash
# For bash/zsh
source .env

# Or use direnv for automatic loading
echo "source .env" > .envrc
direnv allow
```

## Code Quality Tools

### SonarLint Integration

**IntelliJ:**
1. Install SonarLint plugin
2. **File → Settings → Tools → SonarLint**
3. Connect to SonarQube server (if available)

**VS Code:**
```bash
# Install SonarLint extension
# Configure via VS Code settings
```

### Checkstyle Configuration

The project includes Checkstyle rules. Configure your IDE:

**IntelliJ:**
1. Install CheckStyle-IDEA plugin
2. **File → Settings → Tools → Checkstyle**
3. Add configuration file: `config/checkstyle/checkstyle.xml`

### SpotBugs Integration

**Maven Plugin (already configured):**
```bash
# Run SpotBugs analysis
mvn spotbugs:check
```

**IDE Integration:**
- IntelliJ: SpotBugs plugin
- Eclipse: SpotBugs plugin from marketplace

## Docker Development Environment

### Docker Compose for Dependencies

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7-jammy
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: openframe
    volumes:
      - mongo_dev_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

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

  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"
    command: "--jetstream --store_dir=/data"
    volumes:
      - nats_dev_data:/data

volumes:
  mongo_dev_data:
  redis_dev_data:
  nats_dev_data:
```

### Development Scripts

Create helper scripts in `scripts/` directory:

**`scripts/start-dev-env.sh`:**
```bash
#!/bin/bash
echo "Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d
echo "Development services started!"
echo "MongoDB: localhost:27017"
echo "Redis: localhost:6379"
echo "Kafka: localhost:9092"
echo "NATS: localhost:4222"
```

**`scripts/stop-dev-env.sh`:**
```bash
#!/bin/bash
echo "Stopping development environment..."
docker-compose -f docker-compose.dev.yml down
echo "Development services stopped!"
```

**`scripts/reset-dev-data.sh`:**
```bash
#!/bin/bash
echo "Resetting development data..."
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
echo "Development data reset complete!"
```

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

## Productivity Enhancements

### Hot Reloading Setup

Add Spring Boot DevTools to your development profile:

```xml
<!-- In relevant module pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

**IntelliJ Configuration:**
1. **File → Settings → Build → Compiler**
2. Enable "Build project automatically"
3. **Help → Find Action → Registry**
4. Enable `compiler.automake.allow.when.app.running`

### Debug Configurations

**IntelliJ Remote Debug:**
1. **Run → Edit Configurations → Add → Remote JVM Debug**
2. Host: `localhost`, Port: `5005`
3. Command line args: `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005`

**Spring Boot Debug Run Configuration:**
```
VM options: -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005
```

### API Testing Tools

**IntelliJ HTTP Client:**
Create `api-tests.http`:

```http
### Test Health Endpoint
GET http://localhost:8080/health

### GraphQL Query
POST http://localhost:8080/graphql
Content-Type: application/json

{
  "query": "query { __schema { types { name } } }"
}

### REST API Test
GET http://localhost:8080/api/organizations
Authorization: Bearer {{token}}
```

**Alternative Tools:**
- **Postman** - Feature-rich API testing
- **Insomnia** - Simple REST/GraphQL client
- **curl** - Command-line testing

## Performance Monitoring

### JVM Monitoring

**IntelliJ Profiler:**
1. **Run → Profile** instead of Run
2. Monitor memory, CPU, and thread usage

**External Tools:**
- **VisualVM** - Free JVM profiler
- **JProfiler** - Commercial profiler
- **async-profiler** - Low-overhead profiler

### Application Monitoring

Enable Spring Boot Actuator endpoints:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
```

Access monitoring endpoints:
- Health: `http://localhost:8080/actuator/health`
- Metrics: `http://localhost:8080/actuator/metrics`
- Info: `http://localhost:8080/actuator/info`

## Troubleshooting Common Issues

### IDE Performance Issues

**IntelliJ Memory Settings:**
1. **Help → Edit Custom VM Options**
2. Add/modify:
```
-Xmx4g
-XX:MaxMetaspaceSize=1g
-XX:+UseG1GC
```

**Large Project Indexing:**
1. **File → Invalidate Caches and Restart**
2. Exclude build directories: **File → Settings → Directories**

### Build Issues

**Maven Dependency Problems:**
```bash
# Clear local repository
rm -rf ~/.m2/repository
mvn clean install
```

**OutOfMemoryError:**
```bash
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=1g"
mvn clean install
```

### Database Connection Issues

**MongoDB Connection:**
```bash
# Check if MongoDB is running
docker ps | grep mongo
mongosh --eval "db.adminCommand('ping')"
```

**Redis Connection:**
```bash
# Check Redis status
redis-cli ping
```

## Next Steps

With your development environment configured:

1. **[Local Development Guide](local-development.md)** - Learn to run and debug the application
2. **[Architecture Overview](../architecture/README.md)** - Understand the system design
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Follow project conventions

## Getting Help

- **OpenMSP Slack**: [Join the community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) `#development` channel
- **GitHub Issues**: Report environment setup problems

---

*Your development environment is now ready for OpenFrame OSS Libraries development. Happy coding!*