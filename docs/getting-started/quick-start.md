# Quick Start Guide

Get OpenFrame OSS Library running in 5 minutes! This guide will have you building, running, and testing your first OpenFrame service.

> **⚡ TL;DR Goal**: Clone the repo, build the libraries, and run a basic service to verify everything works.

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Verify the structure
ls -la
```

**Expected output:**
```bash
total 64
drwxr-xr-x  20 user  staff    640 Nov 19 10:00 .
drwxr-xr-x   3 user  staff     96 Nov 19 10:00 ..
-rw-r--r--   1 user  staff    123 Nov 19 10:00 .gitignore
-rw-r--r--   1 user  staff   1234 Nov 19 10:00 LICENSE
-rw-r--r--   1 user  staff    789 Nov 19 10:00 README.md
-rw-r--r--   1 user  staff  10456 Nov 19 10:00 pom.xml
drwxr-xr-x   8 user  staff    256 Nov 19 10:00 openframe-api-lib/
drwxr-xr-x   6 user  staff    192 Nov 19 10:00 openframe-core/
drwxr-xr-x   7 user  staff    224 Nov 19 10:00 openframe-data-mongo/
# ... other modules
```

## Step 2: Build the Libraries

```bash
# Clean and install all modules
mvn clean install -DskipTests

# This will:
# 1. Download all dependencies (~5-10 minutes first time)
# 2. Compile all modules
# 3. Install artifacts to local repository
```

**Expected output (final lines):**
```bash
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  02:34 min
[INFO] Finished at: 2024-11-19T10:05:42-05:00
[INFO] ------------------------------------------------------------------------
```

## Step 3: Set Up Local Database

```bash
# Start MongoDB and Redis using Docker
docker run -d \
  --name openframe-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7

docker run -d \
  --name openframe-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify databases are running
docker ps
```

## Step 4: Create a Simple Test Service

Create a minimal Spring Boot application to test the libraries:

```bash
# Create a test directory
mkdir -p test-service/src/main/java/com/example/testservice
cd test-service
```

**Create `pom.xml`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>openframe-test-service</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <properties>
        <java.version>21</java.version>
        <openframe.version>5.10.1</openframe.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        
        <!-- OpenFrame OSS Libraries -->
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-core</artifactId>
            <version>${openframe.version}</version>
        </dependency>
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-api-lib</artifactId>
            <version>${openframe.version}</version>
        </dependency>
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-data-mongo</artifactId>
            <version>${openframe.version}</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

**Create the main application class:**

```java
// src/main/java/com/example/testservice/TestServiceApplication.java
package com.example.testservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class TestServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TestServiceApplication.class, args);
    }

    @GetMapping("/health")
    public String health() {
        return "OpenFrame OSS Library is working! 🚀";
    }

    @GetMapping("/info")
    public java.util.Map<String, Object> info() {
        return java.util.Map.of(
            "service", "OpenFrame Test Service",
            "version", "1.0.0",
            "timestamp", java.time.Instant.now(),
            "libraries", java.util.List.of(
                "openframe-core",
                "openframe-api-lib", 
                "openframe-data-mongo"
            )
        );
    }
}
```

**Create application configuration:**

```yaml
# src/main/resources/application.yml
spring:
  application:
    name: openframe-test-service
  
  data:
    mongodb:
      uri: mongodb://admin:password123@localhost:27017/openframe_test?authSource=admin
    
    redis:
      host: localhost
      port: 6379

server:
  port: 8080

logging:
  level:
    com.openframe: DEBUG
    root: INFO
```

## Step 5: Run the Test Service

```bash
# Build and run the test service
mvn clean package -DskipTests
mvn spring-boot:run
```

**Expected output:**
```bash
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v3.3.0)

2024-11-19T10:10:15.123  INFO --- [           main] c.e.t.TestServiceApplication : Starting TestServiceApplication...
2024-11-19T10:10:16.456  INFO --- [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port(s): 8080 (http)
2024-11-19T10:10:16.789  INFO --- [           main] c.e.t.TestServiceApplication : Started TestServiceApplication in 1.666 seconds
```

## Step 6: Test the Service

Open a new terminal and test the endpoints:

```bash
# Test health endpoint
curl http://localhost:8080/health
# Expected: OpenFrame OSS Library is working! 🚀

# Test info endpoint
curl http://localhost:8080/info | jq '.'
```

**Expected JSON response:**
```json
{
  "service": "OpenFrame Test Service",
  "version": "1.0.0", 
  "timestamp": "2024-11-19T15:10:30.123Z",
  "libraries": [
    "openframe-core",
    "openframe-api-lib",
    "openframe-data-mongo"
  ]
}
```

## Step 7: Test Database Connection

Add a simple database test:

```java
// Add to TestServiceApplication.java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;

@Autowired
private MongoTemplate mongoTemplate;

@GetMapping("/db-test")
public String testDatabase() {
    try {
        // Test MongoDB connection
        mongoTemplate.getCollection("test").countDocuments();
        return "✅ Database connection successful!";
    } catch (Exception e) {
        return "❌ Database connection failed: " + e.getMessage();
    }
}
```

```bash
# Restart the service and test
mvn spring-boot:run

# In another terminal
curl http://localhost:8080/db-test
# Expected: ✅ Database connection successful!
```

## Step 8: Create Your First Document

Test creating a simple organization document:

```java
// Add to TestServiceApplication.java
import com.openframe.data.document.organization.Organization;

@GetMapping("/create-org")
public String createOrganization() {
    try {
        Organization org = new Organization();
        org.setName("Test MSP Company");
        org.setDomain("testmsp.com");
        org.setStatus(/* appropriate status */);
        
        mongoTemplate.save(org);
        
        return "✅ Created organization: " + org.getName();
    } catch (Exception e) {
        return "❌ Failed to create organization: " + e.getMessage();
    }
}
```

```bash
# Test organization creation
curl http://localhost:8080/create-org
# Expected: ✅ Created organization: Test MSP Company
```

## 🎉 Success! What You've Accomplished

In just 5 minutes, you've:

✅ **Built** the entire OpenFrame OSS Library  
✅ **Set up** MongoDB and Redis databases  
✅ **Created** a working Spring Boot service  
✅ **Tested** API endpoints and database connectivity  
✅ **Verified** that OpenFrame libraries are working correctly  

## Quick Verification Checklist

- [ ] Repository cloned successfully
- [ ] Maven build completed without errors
- [ ] Databases are running in Docker
- [ ] Test service starts on port 8080
- [ ] Health endpoint returns success message
- [ ] Database connection test passes
- [ ] Organization creation works

## What's Next?

Now that your environment is working, you can:

1. **[Explore First Steps](first-steps.md)** - Learn core concepts with hands-on examples
2. **[Set up Development Environment](../development/setup/environment.md)** - Configure your IDE and tools
3. **[Explore the Architecture](../development/architecture/overview.md)** - Understand how everything fits together

## Troubleshooting

### Build Fails

```bash
# Check Java version
java -version

# Clear Maven cache and rebuild
rm -rf ~/.m2/repository/com/openframe
mvn clean install -U
```

### Service Won't Start

```bash
# Check if port 8080 is already in use
lsof -i :8080

# Kill any process using the port
kill -9 $(lsof -t -i:8080)

# Start service on different port
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

### Database Connection Issues

```bash
# Check if databases are running
docker ps | grep -E "(mongo|redis)"

# Restart databases
docker restart openframe-mongodb openframe-redis

# Check logs
docker logs openframe-mongodb
```

---

🎊 **Congratulations!** You've successfully set up OpenFrame OSS Library. The foundation is ready - now let's build something amazing!