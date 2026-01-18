# Quick Start Guide

Get up and running with OpenFrame OSS Library in just 5 minutes! This guide will walk you through creating your first device management application.

## TL;DR - 5-Minute Setup

```bash
# 1. Create new Spring Boot project
curl https://start.spring.io/starter.tgz \
  -d dependencies=web,data-mongodb,security \
  -d groupId=com.example \
  -d artifactId=my-openframe-app \
  -d packageName=com.example.openframe \
  -d javaVersion=21 | tar -xzf -

cd my-openframe-app

# 2. Add OpenFrame dependency (build.gradle)
echo 'implementation "com.openframe:openframe-oss-lib:latest"' >> build.gradle

# 3. Start MongoDB
docker run -d --name openframe-mongo -p 27017:27017 mongo:7.0

# 4. Run application
./gradlew bootRun
```

Your OpenFrame application is now running on `http://localhost:8080`! 🎉

## Step-by-Step Setup

### Step 1: Create Spring Boot Project

Using **Spring Initializr**:

```bash
curl https://start.spring.io/starter.tgz \
  -d dependencies=web,data-mongodb,security,actuator \
  -d groupId=com.example \
  -d artifactId=openframe-demo \
  -d packageName=com.example.openframe \
  -d description="OpenFrame%20Demo%20Application" \
  -d javaVersion=21 \
  -d type=gradle-project | tar -xzf -

cd openframe-demo
```

Or create manually with your IDE using these dependencies:
- Spring Web
- Spring Data MongoDB  
- Spring Security
- Spring Boot Actuator

### Step 2: Add OpenFrame Dependency

Add to your `build.gradle`:

```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-mongodb'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    
    // OpenFrame OSS Library
    implementation 'com.openframe:openframe-oss-lib:latest'
    
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
}
```

### Step 3: Configure Application

Create `src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: openframe-demo
  
  # MongoDB Configuration
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe_demo
      auto-index-creation: true
  
  # Security Configuration  
  security:
    user:
      name: admin
      password: demo123
      
# OpenFrame Configuration
openframe:
  security:
    jwt:
      secret: demo-jwt-secret-for-development-only-minimum-32-characters
      expiration: 86400 # 24 hours
    oauth:
      enabled: false # Disable for quick start
  
# Enable health endpoints
management:
  endpoints:
    web:
      exposure:
        include: health,info
```

### Step 4: Create Basic Device Controller

Create `src/main/java/com/example/openframe/controller/DeviceController.java`:

```java
package com.example.openframe.controller;

import com.openframe.data.document.device.Device;
import com.openframe.data.repository.device.MachineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {
    
    @Autowired
    private MachineRepository machineRepository;
    
    @GetMapping
    public List<Device> getAllDevices() {
        return machineRepository.findAll();
    }
    
    @GetMapping("/{id}")
    public Device getDevice(@PathVariable String id) {
        return machineRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Device not found"));
    }
    
    @PostMapping
    public Device createDevice(@RequestBody Device device) {
        device.setLastCheckin(Instant.now());
        return machineRepository.save(device);
    }
    
    @GetMapping("/health")
    public String health() {
        return "OpenFrame Demo API is running!";
    }
}
```

### Step 5: Start Database

#### Option A: Docker (Recommended)

```bash
# Start MongoDB
docker run -d \
  --name openframe-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=openframe_demo \
  mongo:7.0

# Verify it's running
docker logs openframe-mongo
```

#### Option B: Local MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Create database
mongosh --eval "use openframe_demo"
```

### Step 6: Run Your Application

```bash
# Using Gradle Wrapper
./gradlew bootRun

# Or using Maven
./mvnw spring-boot:run
```

Expected output:
```text
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::               (v3.2.0)

2024-01-15 10:30:00.000  INFO --- [main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port(s): 8080 (http)
2024-01-15 10:30:00.000  INFO --- [main] c.e.openframe.OpenframeDemoApplication   : Started OpenframeDemoApplication in 5.234 seconds
```

## Test Your Application

### 1. Check Health Endpoint

```bash
curl http://localhost:8080/api/devices/health
```

Expected response:
```text
OpenFrame Demo API is running!
```

### 2. Create Your First Device

```bash
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "machineId": "demo-machine-001",
    "serialNumber": "SN123456789",
    "model": "Dell OptiPlex 7090",
    "osVersion": "Ubuntu 22.04 LTS",
    "status": "ACTIVE",
    "type": "DESKTOP"
  }'
```

### 3. List All Devices

```bash
curl -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  http://localhost:8080/api/devices
```

Expected response:
```json
[
  {
    "id": "65a5b8c9e4b0f123456789ab",
    "machineId": "demo-machine-001",
    "serialNumber": "SN123456789", 
    "model": "Dell OptiPlex 7090",
    "osVersion": "Ubuntu 22.04 LTS",
    "status": "ACTIVE",
    "type": "DESKTOP",
    "lastCheckin": "2024-01-15T10:35:00.000Z"
  }
]
```

### 4. Check Application Health

```bash
curl http://localhost:8080/actuator/health
```

Expected response:
```json
{
  "status": "UP",
  "components": {
    "mongo": {
      "status": "UP",
      "details": {
        "version": "7.0.0"
      }
    }
  }
}
```

## Expected Results

After completing the quick start, you'll have:

✅ **Working OpenFrame Application** - Spring Boot app with OpenFrame OSS Library  
✅ **MongoDB Integration** - Database connection and document storage  
✅ **Device Management API** - Basic CRUD operations for devices  
✅ **Security Configuration** - Basic authentication setup  
✅ **Health Monitoring** - Application health endpoints  

## Application Structure

Your project structure should look like this:

```text
openframe-demo/
├── build.gradle
├── src/
│   ├── main/
│   │   ├── java/com/example/openframe/
│   │   │   ├── OpenframeDemoApplication.java
│   │   │   └── controller/
│   │   │       └── DeviceController.java
│   │   └── resources/
│   │       └── application.yml
│   └── test/
└── gradle/
```

## Common Issues & Solutions

### Issue: "Connection refused to MongoDB"
```bash
# Check if MongoDB is running
docker ps | grep mongo
# Restart if needed
docker restart openframe-mongo
```

### Issue: "Access denied" errors
```bash
# Check authentication (username: admin, password: demo123)
echo -n "admin:demo123" | base64
# Should output: YWRtaW46ZGVtbzEyMw==
```

### Issue: "Port 8080 already in use"
```bash
# Find process using port
lsof -i :8080
# Kill if needed or change port in application.yml
```

## Next Steps

🎉 **Congratulations!** You've successfully created your first OpenFrame application.

Continue your journey:

1. **[First Steps](./first-steps.md)** - Explore key OpenFrame features
2. **[Development Guide](../development/README.md)** - Learn about architecture and best practices  
3. **[API Reference](../reference/architecture/overview.md)** - Comprehensive API documentation

## Need Help?

- 💬 **Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 📚 **Documentation**: [Development Guide](../development/README.md)
- 🚀 **Platform**: [OpenFrame.ai](https://openframe.ai)

Ready to build amazing device management solutions with OpenFrame! 🚀