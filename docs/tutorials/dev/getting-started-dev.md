# Developer Getting Started Guide

Welcome to OpenFrame OSS development! This guide will help you set up your development environment and understand the codebase structure.

## Development Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Java JDK** | 21+ | Core development platform |
| **Maven** | 3.6+ | Build tool and dependency management |
| **IDE** | IntelliJ/Eclipse/VS Code | Code editing with Java support |
| **Git** | 2.30+ | Version control |
| **MongoDB** | 4.4+ | Database for local development |
| **Docker** | 20.10+ | Containerization and local services |
| **Postman/curl** | Latest | API testing |

## Quick Development Setup

```mermaid
flowchart TD
    A[Clone Repository] --> B[Install Prerequisites]
    B --> C[Set up IDE]
    C --> D[Start MongoDB]
    D --> E[Run Maven Install]
    E --> F[Configure Environment]
    F --> G[Start Services]
    G --> H[Run Tests]
    H --> I[Start Development]
    
    style A fill:#e1f5fe
    style I fill:#c8e6c9
```

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Set Java environment
export JAVA_HOME=/path/to/java21
export PATH=$JAVA_HOME/bin:$PATH

# Verify Java version
java -version
mvn --version
```

### 2. Local Development Services

**Start MongoDB with Docker:**
```bash
# Create development MongoDB
docker run --name openframe-dev-mongo -d \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=dev \
  -e MONGO_INITDB_ROOT_PASSWORD=devpass \
  -v openframe-mongo-data:/data/db \
  mongo:7.0

# Start Kafka (optional - for event processing)
docker run --name openframe-dev-kafka -d \
  -p 9092:9092 \
  -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  confluentinc/cp-kafka:latest
```

### 3. Build and Test

```bash
# Clean build with tests
mvn clean install

# Skip tests for faster builds during development
mvn clean install -DskipTests

# Run tests only
mvn test

# Build specific module
mvn clean install -pl openframe-api-service-core -am
```

## Repository Structure

```
openframe-oss-lib/
├── 📁 openframe-core/                    # Core utilities and shared components
├── 📁 openframe-data/                    # Data access abstractions
├── 📁 openframe-data-mongo/              # MongoDB implementations
├── 📁 openframe-data-kafka/              # Kafka event streaming
├── 📁 openframe-security-core/           # Security and authentication
├── 📁 openframe-security-oauth/          # OAuth2/JWT implementations
├── 📁 openframe-api-lib/                 # Shared API DTOs and services
│   ├── 📄 src/main/java/com/openframe/api/dto/        # Data transfer objects
│   ├── 📄 src/main/java/com/openframe/api/service/    # Business services
│   └── 📄 src/main/java/com/openframe/api/mapper/     # Data mappers
├── 📁 openframe-api-service-core/        # Main API service
│   ├── 📄 src/main/java/com/openframe/api/config/     # Spring configuration
│   ├── 📄 src/main/java/com/openframe/api/controller/ # REST controllers
│   └── 📄 src/main/resources/            # Application properties
├── 📁 openframe-management-service-core/ # Management and admin APIs
├── 📁 openframe-gateway-service-core/    # API Gateway service
├── 📁 openframe-client-core/             # Client libraries
├── 📁 sdk/                               # External SDK integrations
│   ├── 📄 fleetmdm/                      # FleetMDM integration
│   └── 📄 tacticalrmm/                   # TacticalRMM integration
├── 📄 pom.xml                            # Parent POM configuration
└── 📄 README.md                          # Project documentation
```

### Key Directories Explained

<details>
<summary><strong>Core Modules</strong></summary>

- **openframe-core**: Base utilities, exceptions, and shared interfaces
- **openframe-data**: Repository abstractions and data access patterns
- **openframe-security-core**: Authentication, authorization, and security utilities

</details>

<details>
<summary><strong>Service Modules</strong></summary>

- **openframe-api-service-core**: Main REST API with device, organization, and user management
- **openframe-management-service-core**: Administrative operations and system management
- **openframe-gateway-service-core**: API gateway with routing and load balancing

</details>

<details>
<summary><strong>Integration Modules</strong></summary>

- **openframe-data-mongo**: MongoDB repositories and configuration
- **openframe-data-kafka**: Event streaming and message processing
- **sdk/**: External system integrations (MDM tools, RMM systems)

</details>

## Development Workflow

### Starting Development Services

**Option 1: Individual Service Development**
```bash
# Navigate to the service you're working on
cd openframe-api-service-core

# Run in development mode with hot reload
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Or with custom configuration
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

**Option 2: Multi-Service Development**
```bash
# Start API service (Terminal 1)
cd openframe-api-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Start Management service (Terminal 2)  
cd openframe-management-service-core
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8082

# Start Gateway service (Terminal 3)
cd openframe-gateway-service-core  
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8083
```

### Development Configuration

Create `src/main/resources/application-dev.yml`:

```yaml
# Development configuration
spring:
  profiles:
    active: dev
  
  data:
    mongodb:
      uri: mongodb://dev:devpass@localhost:27017/openframe_dev
      
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: openframe-dev
      
  jpa:
    show-sql: true
    hibernate:
      ddl-auto: create-drop

# Development-specific settings
logging:
  level:
    com.openframe: DEBUG
    org.springframework.security: DEBUG
    org.springframework.data.mongodb: DEBUG
    
server:
  port: 8080
  
# Development JWT settings (DO NOT use in production)
openframe:
  security:
    jwt:
      secret: dev-jwt-secret-key-not-for-production
      expiration: 86400000 # 24 hours
  
  features:
    debug-mode: true
    mock-external-apis: true
```

### Code Style and Conventions

**Java Coding Standards:**
- Use **Lombok** annotations to reduce boilerplate code
- Follow **Spring Boot** naming conventions
- Use **@Slf4j** for logging instead of System.out.println()
- Write **JavaDoc** for public APIs
- Use **@Valid** for request validation

**Example Service Class:**
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;
    
    /**
     * Updates the status of a device by machine ID
     * 
     * @param machineId the unique machine identifier
     * @param status the new device status
     * @throws DeviceNotFoundException if device is not found
     */
    @Transactional
    public void updateStatusByMachineId(String machineId, DeviceStatus status) {
        log.info("Updating device status: {} -> {}", machineId, status);
        
        Device device = deviceRepository.findByMachineId(machineId)
            .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
            
        device.setStatus(status);
        device.setLastUpdated(Instant.now());
        
        deviceRepository.save(device);
        log.debug("Device status updated successfully: {}", machineId);
    }
}
```

### Testing Strategy

**Unit Tests:**
```bash
# Run all unit tests
mvn test

# Run tests for specific module
mvn test -pl openframe-api-service-core

# Run specific test class
mvn test -Dtest=DeviceServiceTest

# Run with coverage
mvn test jacoco:report
```

**Integration Tests:**
```bash
# Run integration tests (requires test containers)
mvn verify -P integration-tests

# Run API integration tests
mvn test -Dtest=*IntegrationTest
```

**Example Test Class:**
```java
@SpringBootTest
@Testcontainers
@Slf4j
class DeviceServiceIntegrationTest {
    
    @Container
    static MongoDBContainer mongodb = new MongoDBContainer("mongo:7.0");
    
    @Autowired
    private DeviceService deviceService;
    
    @Test
    @DisplayName("Should update device status successfully")
    void shouldUpdateDeviceStatus() {
        // Given
        String machineId = "test-device-001";
        DeviceStatus newStatus = DeviceStatus.ACTIVE;
        
        // When
        deviceService.updateStatusByMachineId(machineId, newStatus);
        
        // Then
        Device updated = deviceService.findByMachineId(machineId);
        assertThat(updated.getStatus()).isEqualTo(newStatus);
        assertThat(updated.getLastUpdated()).isNotNull();
    }
}
```

### Debugging Tips

**Common Development Issues:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **MongoDB Connection** | Service fails to start | Check Docker container is running: `docker ps` |
| **Port Conflicts** | Address already in use | Change port: `--server.port=8081` or stop conflicting service |
| **Maven Dependencies** | ClassNotFoundException | Run `mvn clean install -U` to update dependencies |
| **Hot Reload Not Working** | Changes not reflected | Use `spring-boot-devtools` dependency |
| **Test Failures** | Tests pass locally but fail in CI | Use Testcontainers for consistent test environments |

**Debugging with IDE:**
1. **IntelliJ IDEA:**
   - Import as Maven project
   - Enable annotation processing for Lombok
   - Set Java SDK to 21
   - Use Spring Boot run configuration

2. **VS Code:**
   - Install Extension Pack for Java
   - Install Spring Boot Extension Pack
   - Use Java debugger for breakpoints

**Debugging API Calls:**
```bash
# Enable debug logging for all requests
export LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_WEB=DEBUG

# Test API endpoints
curl -v http://localhost:8080/health

# Check application logs
tail -f logs/openframe-api.log
```

### Contributing Guidelines

**Before Submitting Code:**

1. **Run Quality Checks:**
   ```bash
   # Code formatting
   mvn spotless:apply
   
   # Static analysis
   mvn spotbugs:check
   
   # Security scan
   mvn org.owasp:dependency-check-maven:check
   ```

2. **Ensure Tests Pass:**
   ```bash
   mvn clean verify
   ```

3. **Update Documentation:**
   - Add JavaDoc for new public methods
   - Update README.md if adding new features
   - Include integration examples

**Git Workflow:**
```bash
# Create feature branch
git checkout -b feature/device-batch-operations

# Make commits with descriptive messages
git commit -m "Add batch device status update endpoint

- Implement POST /devices/batch-update endpoint
- Add validation for batch size limits
- Include unit and integration tests
- Update API documentation"

# Push and create pull request
git push origin feature/device-batch-operations
```

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:
- `feat(api): add device batch operations endpoint`
- `fix(auth): resolve JWT token expiration issue`
- `docs(readme): update installation instructions`
- `test(device): add integration tests for device service`

---

## Next Steps

🎉 **Congratulations!** Your development environment is ready.

**What's Next?**
- 🏗️ Explore the [Architecture Overview](architecture-overview-dev.md)
- 📝 Read the [API Documentation](https://docs.openframe.dev/api)
- 🔍 Browse existing issues on [GitHub](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- 💬 Join our [Developer Discord](https://discord.gg/openframe)

**Quick Development Tasks:**
1. Add a new REST endpoint to DeviceController
2. Create a new service method with proper error handling
3. Write comprehensive tests for your changes
4. Update the API documentation

---

*Happy coding! This guide covers the essentials for getting started. For advanced topics, check our architecture documentation.*