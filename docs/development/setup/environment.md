# Development Environment Setup

This guide will help you configure your development environment for maximum productivity when working with OpenFrame OSS Library. We'll cover IDE setup, essential plugins, and development-specific configurations.

## IDE Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides the best experience for Spring Boot and Java development with OpenFrame.

#### Installation

**Option 1: JetBrains Toolbox (Recommended)**
```bash
# Download and install JetBrains Toolbox
# https://www.jetbrains.com/toolbox-app/

# Install IntelliJ IDEA Ultimate or Community through Toolbox
```

**Option 2: Direct Download**
- Download from [JetBrains Website](https://www.jetbrains.com/idea/)
- Choose Ultimate (paid) or Community (free) edition

#### Required Plugins

Install these plugins through `File` → `Settings` → `Plugins`:

| Plugin | Purpose | Essential |
|--------|---------|-----------|
| **Lombok** | Reduces boilerplate code | ✅ Required |
| **Spring Boot** | Spring framework support | ✅ Required |
| **MongoDB Plugin** | Database integration | ✅ Required |
| **Docker** | Container management | ✅ Required |
| **Maven Helper** | Dependency analysis | ✅ Recommended |
| **SonarLint** | Code quality analysis | ✅ Recommended |
| **GitToolBox** | Enhanced Git integration | 🔧 Optional |
| **Rainbow Brackets** | Code readability | 🔧 Optional |
| **Key Promoter X** | Learn shortcuts | 🔧 Optional |

#### Configuration Steps

**1. Configure Project SDK**
```text
File → Project Structure → Project → Project SDK → Select Java 21
```

**2. Enable Annotation Processing**
```text
File → Settings → Build → Compiler → Annotation Processors
✅ Enable annotation processing
✅ Store generated sources relative to: Module content root
```

**3. Configure Code Style**
```text
File → Settings → Editor → Code Style → Java
Scheme: Import from openframe-codestyle.xml (if available)
Or use Google Java Style Guide
```

**4. Set up Live Templates**
```text
File → Settings → Editor → Live Templates → Add Group: "OpenFrame"
```

Add these useful templates:
```java
// ofservice - OpenFrame Service Template
@Service
public class $NAME$ {
    
    public $END$
}

// ofdto - OpenFrame DTO Template  
public class $NAME$ {
    $END$
}

// oftest - OpenFrame Test Template
@Test
public void $NAME$() {
    // Given
    $GIVEN$
    
    // When
    $WHEN$
    
    // Then
    $THEN$$END$
}
```

### VS Code Configuration

If you prefer VS Code, here's how to set it up for OpenFrame development.

#### Required Extensions

```bash
# Install essential Java extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension vmware.vscode-spring-boot
code --install-extension mongodb.mongodb-vscode
code --install-extension ms-azuretools.vscode-docker

# Install helpful additional extensions
code --install-extension sonarsource.sonarlint-vscode
code --install-extension gabrielbb.vscode-lombok
code --install-extension redhat.vscode-yaml
```

#### VS Code Settings

Create `.vscode/settings.json` in your workspace:

```json
{
    "java.home": "/path/to/java21",
    "java.configuration.runtimes": [
        {
            "name": "JavaSE-21",
            "path": "/path/to/java21",
            "default": true
        }
    ],
    "java.compile.nullAnalysis.mode": "automatic",
    "java.completion.enabled": true,
    "java.errors.incompleteClasspath.severity": "warning",
    
    "spring-boot.ls.java.home": "/path/to/java21",
    "spring-boot.ls.java.vmargs": [
        "-Xmx2G",
        "-XX:TieredStopAtLevel=1"
    ],
    
    "files.exclude": {
        "**/target": true,
        "**/.classpath": true,
        "**/.project": true,
        "**/.settings": true,
        "**/.factorypath": true
    },
    
    "java.format.settings.url": "https://raw.githubusercontent.com/google/styleguide/gh-pages/eclipse-java-google-style.xml"
}
```

#### Launch Configuration

Create `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "OpenFrame Test Service",
            "request": "launch",
            "mainClass": "com.example.testservice.TestServiceApplication",
            "projectName": "openframe-test-service",
            "args": "",
            "vmArgs": "-Xmx2G -Dspring.profiles.active=dev",
            "env": {
                "SPRING_DATA_MONGODB_URI": "mongodb://admin:password123@localhost:27017/openframe?authSource=admin"
            }
        },
        {
            "type": "java",
            "name": "Debug OpenFrame",
            "request": "attach",
            "hostName": "localhost",
            "port": 5005
        }
    ]
}
```

## Development Tools Setup

### Maven Configuration

Create or update `~/.m2/settings.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/maven-1.0.0.xsd">
    
    <!-- Local Repository Path -->
    <localRepository>${user.home}/.m2/repository</localRepository>
    
    <!-- Offline Mode -->
    <offline>false</offline>
    
    <!-- Plugin Groups -->
    <pluginGroups>
        <pluginGroup>org.springframework.boot</pluginGroup>
    </pluginGroups>
    
    <!-- Mirrors for faster downloads -->
    <mirrors>
        <mirror>
            <id>central-mirror</id>
            <name>Maven Central Mirror</name>
            <url>https://repo1.maven.org/maven2</url>
            <mirrorOf>central</mirrorOf>
        </mirror>
    </mirrors>
    
    <!-- Profiles -->
    <profiles>
        <profile>
            <id>dev</id>
            <activation>
                <activeByDefault>true</activeByDefault>
            </activation>
            <properties>
                <maven.compiler.source>21</maven.compiler.source>
                <maven.compiler.target>21</maven.compiler.target>
                <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            </properties>
        </profile>
    </profiles>
</settings>
```

### Docker Development Setup

Create a `docker-compose.dev.yml` for local development:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: openframe-dev-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: openframe_dev
    volumes:
      - mongodb_dev_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - openframe-dev

  redis:
    image: redis:7-alpine
    container_name: openframe-dev-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data
    networks:
      - openframe-dev

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: openframe-dev-kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    depends_on:
      - zookeeper
    networks:
      - openframe-dev

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: openframe-dev-zookeeper
    restart: unless-stopped
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_dev_data:/var/lib/zookeeper/data
    networks:
      - openframe-dev

  mongodb-express:
    image: mongo-express:latest
    container_name: openframe-dev-mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: password123
      ME_CONFIG_MONGODB_URL: mongodb://admin:password123@mongodb:27017/
    depends_on:
      - mongodb
    networks:
      - openframe-dev

volumes:
  mongodb_dev_data:
  redis_dev_data:
  zookeeper_dev_data:

networks:
  openframe-dev:
    driver: bridge
```

**Start development services:**

```bash
# Start all development services
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Environment Variables

Create a `.env.dev` file for development environment variables:

```bash
# Database Configuration
SPRING_DATA_MONGODB_URI=mongodb://admin:password123@localhost:27017/openframe_dev?authSource=admin
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_DATABASE=1

# Kafka Configuration  
SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092
SPRING_KAFKA_CONSUMER_GROUP_ID=openframe-dev

# Security Configuration
JWT_SECRET=dev-secret-key-change-this-in-production-environments-use-256-bit-key
JWT_EXPIRATION=86400
OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET=your-google-client-secret

# Application Configuration
SPRING_PROFILES_ACTIVE=dev,local
SERVER_PORT=8080
LOGGING_LEVEL_COM_OPENFRAME=DEBUG
LOGGING_LEVEL_ORG_MONGODB_DRIVER=WARN

# Development Tools
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=*
MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always
SPRING_DEVTOOLS_RESTART_ENABLED=true
SPRING_DEVTOOLS_LIVERELOAD_ENABLED=true

# External Service URLs (for development)
OPENFRAME_EXTERNAL_FLEETDM_URL=http://localhost:8080/fleet
OPENFRAME_EXTERNAL_TACTICALRMM_URL=http://localhost:8000
```

## Code Quality Tools

### SonarQube Local Setup

```bash
# Start SonarQube with Docker
docker run -d --name openframe-sonarqube \
  -p 9000:9000 \
  sonarqube:community

# Wait for SonarQube to start, then visit http://localhost:9000
# Default login: admin/admin

# Run analysis
mvn sonar:sonar \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=admin \
  -Dsonar.password=admin
```

### Pre-commit Hooks

Install Git hooks for code quality:

```bash
# Install pre-commit tool
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: local
    hooks:
      - id: maven-compile
        name: Maven Compile
        entry: mvn compile -q
        language: system
        pass_filenames: false
        
      - id: maven-test
        name: Maven Test
        entry: mvn test -q
        language: system
        pass_filenames: false
EOF

# Install hooks
pre-commit install
```

## Performance Profiling

### JProfiler Integration

If you have JProfiler, configure it for OpenFrame development:

```bash
# Add to your application startup
-agentpath:/path/to/jprofiler/bin/linux-x64/libjprofilerti.so=port=8849
```

### Built-in Profiling

Use JVM built-in profiling tools:

```bash
# Add to application startup for profiling
-XX:+FlightRecorder 
-XX:StartFlightRecording=duration=60s,filename=openframe-profile.jfr
-XX:+UnlockDiagnosticVMOptions
-XX:+DebugNonSafepoints
```

## Development Scripts

Create useful development scripts in `scripts/` directory:

**`scripts/dev-setup.sh`:**
```bash
#!/bin/bash
set -e

echo "🚀 Setting up OpenFrame development environment..."

# Start development services
echo "📦 Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Build the project
echo "🔨 Building OpenFrame libraries..."
mvn clean install -DskipTests -q

# Run tests
echo "🧪 Running tests..."
mvn test -q

echo "✅ Development environment ready!"
echo "🌐 Services available at:"
echo "   - MongoDB: mongodb://localhost:27017"
echo "   - Redis: redis://localhost:6379"  
echo "   - Kafka: localhost:9092"
echo "   - Mongo Express: http://localhost:8081"
echo ""
echo "🚀 Ready to start developing!"
```

**`scripts/dev-clean.sh`:**
```bash
#!/bin/bash
set -e

echo "🧹 Cleaning development environment..."

# Stop and remove containers
docker-compose -f docker-compose.dev.yml down -v

# Clean Maven build
mvn clean -q

# Clear IDE caches
rm -rf .idea/caches/
rm -rf target/
find . -name "*.iml" -delete

echo "✅ Development environment cleaned!"
```

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

## Troubleshooting

### Common IDE Issues

<details>
<summary>Lombok not working</summary>

**Symptoms**: Getters/setters not found, compilation errors

**Solutions**:
1. Verify Lombok plugin is installed and enabled
2. Check annotation processing is enabled
3. Rebuild project: `Build` → `Rebuild Project`
4. Restart IDE
</details>

<details>
<summary>Spring Boot autoconfiguration not working</summary>

**Symptoms**: Beans not found, configuration not loaded

**Solutions**:
1. Check `@SpringBootApplication` annotation
2. Verify component scanning paths
3. Check for conflicting configurations
4. Review application.yml/properties
</details>

<details>
<summary>Maven dependencies not resolving</summary>

**Symptoms**: Classes not found, NoClassDefFound errors

**Solutions**:
1. Refresh Maven project: `View` → `Tool Windows` → `Maven` → Refresh
2. Clear Maven cache: `rm -rf ~/.m2/repository`
3. Reload Gradle project if using Gradle wrapper
4. Check proxy settings in IDE
</details>

## Performance Tips

### JVM Configuration

Add to your IDE VM options for better performance:

```bash
-Xmx4G
-Xms1G
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:+UnlockExperimentalVMOptions
-XX:+UseJVMCICompiler
```

### IDE Performance

**IntelliJ IDEA:**
- Increase IDE memory: `Help` → `Change Memory Settings` → 4GB+
- Disable unused plugins
- Exclude target directories from indexing
- Use Power Save mode when on battery

**VS Code:**
- Increase Java heap: `-Xmx4G` in Java extension settings
- Disable unnecessary extensions
- Use workspace settings for project-specific configuration

## Next Steps

✅ **Environment Configured?** Continue to [Local Development Setup](local-development.md) to start running OpenFrame services locally.

---

Your development environment is now optimized for OpenFrame development! You should have everything you need for productive coding, debugging, and testing. 🚀