# Quick Start

Get OpenFrame OSS Lib running locally in 5 minutes with this streamlined setup guide.

## Prerequisites Check

Before starting, ensure you have:
- ✅ Java 21 installed
- ✅ Maven 3.8+ installed
- ✅ Git installed

```bash
# Quick verification
java -version && mvn -version && git --version
```

If any command fails, see the [Prerequisites Guide](prerequisites.md) for installation instructions.

## 1. Clone the Repository

```bash
# Clone the OpenFrame OSS Lib repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

## 2. Build the Project

```bash
# Clean and build all modules
mvn clean install -DskipTests

# This will:
# - Download all Maven dependencies
# - Compile all 15 core modules
# - Create JAR artifacts
# - Skip tests for faster initial setup
```

**Expected Output:**
```text
[INFO] Reactor Summary for OpenFrame OSS Libraries 5.30.0:
[INFO] 
[INFO] OpenFrame OSS Libraries ........................ SUCCESS
[INFO] openframe-core ................................. SUCCESS
[INFO] openframe-data-mongo ........................... SUCCESS
[INFO] openframe-data-redis ........................... SUCCESS
[INFO] openframe-notification-mail .................... SUCCESS
[INFO] openframe-data-kafka ........................... SUCCESS
[INFO] openframe-api-lib .............................. SUCCESS
[INFO] openframe-data ................................. SUCCESS
[INFO] openframe-security-core ........................ SUCCESS
[INFO] openframe-authorization-service-core ........... SUCCESS
[INFO] openframe-client-core .......................... SUCCESS
[INFO] openframe-api-service-core ..................... SUCCESS
[INFO] openframe-management-service-core .............. SUCCESS
[INFO] sdk : fleetmdm ................................. SUCCESS
[INFO] sdk : tacticalrmm .............................. SUCCESS
[INFO] openframe-security-oauth ....................... SUCCESS
[INFO] openframe-idp-configuration .................... SUCCESS
[INFO] openframe-config-core .......................... SUCCESS
[INFO] openframe-external-api-service-core ............ SUCCESS
[INFO] openframe-stream-service-core .................. SUCCESS
[INFO] openframe-gateway-service-core ................. SUCCESS
[INFO] openframe-test-service-core .................... SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
```

## 3. Set Up Basic Dependencies (Docker)

For a quick start, use Docker to run required services:

```bash
# Create a docker-compose.yml for development
cat > docker-compose.yml << EOF
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=openframe-dev
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
EOF

# Start the services
docker-compose up -d

# Verify services are running
docker-compose ps
```

## 4. Run Basic Tests

```bash
# Run unit tests to verify the build
mvn test -Dtest=*Test -DfailIfNoTests=false

# Run specific core module tests
mvn test -pl openframe-core -Dtest=*Test
```

## 5. Explore the Module Structure

```bash
# List all modules
ls -la

# Explore a core module structure
tree openframe-core/src/main/java/com/openframe/core -I '*.class'
```

**Module Overview:**

```text
openframe-oss-lib/
├── openframe-core/                 # Core utilities and validation
├── openframe-data-mongo/           # MongoDB data layer
├── openframe-data-redis/           # Redis caching layer
├── openframe-security-core/        # Security and JWT utilities
├── openframe-api-lib/              # Shared API contracts and DTOs
├── openframe-api-service-core/     # GraphQL and REST API server
├── openframe-authorization-service-core/ # OAuth2 authorization server
├── openframe-client-core/          # Agent lifecycle management
├── openframe-gateway-service-core/ # API Gateway (Spring Cloud)
└── ... (additional specialized modules)
```

## 6. Verify Integration Points

### Test Database Connectivity

```bash
# Test MongoDB connection
docker exec -it $(docker-compose ps -q mongodb) mongosh openframe-dev --eval "db.adminCommand('ping')"

# Test Redis connection  
docker exec -it $(docker-compose ps -q redis) redis-cli ping
```

### Inspect Generated JARs

```bash
# List generated artifacts
find . -name "*.jar" -type f | grep -E "(openframe|fleetmdm|tacticalrmm)" | head -10
```

## 7. Run a Simple Integration Test

```bash
# Test the core module functionality
cd openframe-core
mvn test -Dtest=*ValidationTest

# Test MongoDB integration
cd ../openframe-data-mongo
mvn test -Dtest=*RepositoryTest -DfailIfNoTests=false
```

## Hello World Example

Create a simple test to verify the libraries are working:

```bash
# Create a test directory
mkdir -p hello-openframe/src/main/java/com/example
cd hello-openframe

# Create a simple Maven project
cat > pom.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>hello-openframe</artifactId>
    <version>1.0.0</version>
    
    <properties>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-core</artifactId>
            <version>5.30.0</version>
        </dependency>
    </dependencies>
</project>
EOF

# Create a simple Java class
cat > src/main/java/com/example/HelloOpenFrame.java << EOF
package com.example;

import com.openframe.core.util.SlugUtil;

public class HelloOpenFrame {
    public static void main(String[] args) {
        System.out.println("Hello OpenFrame OSS Lib!");
        
        // Use a core utility
        String slug = SlugUtil.createSlug("Hello OpenFrame World!");
        System.out.println("Generated slug: " + slug);
        
        System.out.println("🎉 OpenFrame OSS Lib is working correctly!");
    }
}
EOF

# Build and run
mvn clean compile exec:java -Dexec.mainClass="com.example.HelloOpenFrame"
```

**Expected Output:**
```text
Hello OpenFrame OSS Lib!
Generated slug: hello-openframe-world
🎉 OpenFrame OSS Lib is working correctly!
```

## Next Steps

Congratulations! You've successfully:

✅ Built all 15 OpenFrame OSS Lib modules  
✅ Set up development dependencies  
✅ Verified the integration works  
✅ Created a simple "Hello World" example  

### Explore Further

1. **[First Steps Guide](first-steps.md)** - Learn about key features and capabilities
2. **[Development Setup](../development/setup/local-development.md)** - Set up for advanced development
3. **[Architecture Overview](../development/architecture/README.md)** - Understand the system design

### Watch the Platform Demo

[![OpenFrame: 5-Minute MSP Platform Walkthrough - Cut Vendor Costs & Automate Ops](https://img.youtube.com/vi/er-z6IUnAps/maxresdefault.jpg)](https://www.youtube.com/watch?v=er-z6IUnAps)

## Troubleshooting

### Build Failures

```bash
# Clear Maven cache and rebuild
rm -rf ~/.m2/repository/com/openframe
mvn clean install -U
```

### Docker Issues

```bash
# Reset Docker environment
docker-compose down -v
docker-compose up -d

# Check container logs
docker-compose logs mongodb
docker-compose logs redis
```

### Java Version Issues

```bash
# Ensure Java 21 is active
export JAVA_HOME=/path/to/java-21
export PATH=$JAVA_HOME/bin:$PATH

# Verify
java -version
```

## Getting Help

- **Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Documentation**: Continue with [First Steps](first-steps.md)
- **Full Setup**: See [Development Environment Setup](../development/setup/environment.md)

---

**Ready to dive deeper?** Continue with the [First Steps Guide](first-steps.md) to explore OpenFrame OSS Lib's key features!