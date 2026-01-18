# First Steps with OpenFrame OSS Library

Now that you have OpenFrame running, let's explore the key features and capabilities that make it a powerful foundation for device management platforms.

## Your First 5 Things to Do

### 1. 📱 Explore Device Management Features

OpenFrame provides comprehensive device management capabilities. Let's create devices of different types and explore their features:

```bash
# Create a laptop device
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "machineId": "laptop-001",
    "serialNumber": "LP987654321",
    "model": "MacBook Pro 16\"",
    "osVersion": "macOS 14.0",
    "status": "ACTIVE",
    "type": "LAPTOP"
  }'

# Create a server device
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "machineId": "server-001",
    "serialNumber": "SRV555666777",
    "model": "Dell PowerEdge R740",
    "osVersion": "Ubuntu Server 22.04 LTS",
    "status": "ACTIVE",
    "type": "SERVER"
  }'
```

**Device Types Supported:**
- `DESKTOP` - Workstations and desktop computers
- `LAPTOP` - Portable computers and notebooks  
- `SERVER` - Server hardware and infrastructure

### 2. 🏢 Set Up Organization Management

Organizations are the foundation of multi-tenant architecture. Create your first organization:

```bash
# Create an organization
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "contactInformation": {
      "email": "admin@acme-corp.com",
      "phone": "+1-555-123-4567",
      "website": "https://acme-corp.com"
    },
    "address": {
      "street": "123 Business Ave",
      "city": "Tech City", 
      "state": "CA",
      "zipCode": "94105",
      "country": "USA"
    }
  }'
```

### 3. 📊 Understand Event & Audit System

OpenFrame provides comprehensive event tracking. Let's explore the audit capabilities:

```bash
# Create an event
curl -X POST http://localhost:8080/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "type": "DEVICE_REGISTERED",
    "source": "SYSTEM",
    "machineId": "demo-machine-001",
    "organizationId": "your-org-id",
    "details": {
      "action": "Device successfully registered",
      "userAgent": "OpenFrame Demo App",
      "ipAddress": "192.168.1.100"
    }
  }'

# Query recent events
curl -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  "http://localhost:8080/api/events?limit=10&sort=timestamp:desc"
```

### 4. 🔐 Configure Security & Authentication

OpenFrame includes enterprise-grade security features. Let's configure JWT authentication:

**Update your `application.yml`:**

```yaml
openframe:
  security:
    jwt:
      secret: your-secure-jwt-secret-minimum-32-characters-long
      expiration: 86400 # 24 hours
      refresh-expiration: 604800 # 7 days
    oauth:
      enabled: true
      providers:
        google:
          client-id: ${GOOGLE_CLIENT_ID:}
          client-secret: ${GOOGLE_CLIENT_SECRET:}
          redirect-uri: http://localhost:8080/oauth/callback/google
```

### 5. 🔧 Explore Tool Integration Capabilities

OpenFrame supports integration with popular RMM tools. Here's how to configure a tool connection:

```bash
# Register a tool connection
curl -X POST http://localhost:8080/api/tools \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46ZGVtbzEyMw==" \
  -d '{
    "name": "Fleet MDM Instance",
    "type": "FLEET_MDM",
    "url": "https://fleet.example.com",
    "credentials": {
      "apiKey": "fleet-api-key-here",
      "organizationId": "fleet-org-123"
    },
    "status": "CONNECTED"
  }'
```

## Initial Configuration Options

### Database Indexing

OpenFrame automatically creates database indexes for optimal performance. You can verify them:

```bash
# Connect to MongoDB and check indexes
mongosh openframe_demo --eval "
  db.devices.getIndexes();
  db.organizations.getIndexes();
  db.events.getIndexes();
"
```

### Enable Caching (Optional)

Add Redis for improved performance:

```yaml
# Add to application.yml
spring:
  cache:
    type: redis
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2000ms

openframe:
  cache:
    enabled: true
    ttl: 3600 # 1 hour
```

### Configure Pagination

OpenFrame uses cursor-based pagination by default. Customize pagination settings:

```yaml
openframe:
  pagination:
    default-size: 20
    max-size: 100
    cursor-field: id
```

## Key Features to Explore

### Multi-Tenant Data Isolation

```mermaid
graph TB
    subgraph "Tenant A"
        A1[Devices A]
        A2[Users A] 
        A3[Events A]
    end
    
    subgraph "Tenant B"
        B1[Devices B]
        B2[Users B]
        B3[Events B] 
    end
    
    subgraph "Shared Infrastructure"
        DB[(MongoDB)]
        REDIS[(Redis)]
    end
    
    A1 --> DB
    A2 --> DB
    A3 --> DB
    B1 --> DB
    B2 --> DB
    B3 --> DB
    
    A1 --> REDIS
    B1 --> REDIS
```

### Real-time Event Processing

```mermaid
sequenceDiagram
    participant Device
    participant Gateway
    participant EventService
    participant AuditStore
    participant Dashboard
    
    Device->>Gateway: Status Update
    Gateway->>EventService: Process Event
    EventService->>AuditStore: Store Audit Trail
    EventService->>Dashboard: Real-time Notification
    Dashboard-->>Device: Show Updated Status
```

### API Security Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant AuthService
    participant ResourceAPI
    
    Client->>Gateway: Request + JWT
    Gateway->>AuthService: Validate Token
    AuthService-->>Gateway: Token Valid
    Gateway->>ResourceAPI: Forward Request
    ResourceAPI-->>Gateway: Response
    Gateway-->>Client: Authorized Response
```

## Common Configuration Patterns

### Environment-Based Configuration

Create environment-specific configurations:

**Development (`application-dev.yml`):**
```yaml
openframe:
  security:
    jwt:
      secret: dev-jwt-secret-for-development-only
  logging:
    level: DEBUG
  cache:
    enabled: false
```

**Production (`application-prod.yml`):**
```yaml
openframe:
  security:
    jwt:
      secret: ${JWT_SECRET}
  logging:
    level: INFO
  cache:
    enabled: true
    ttl: 3600
```

### Custom Service Implementation

Extend OpenFrame with custom business logic:

```java
@Service
public class CustomDeviceService {
    
    @Autowired
    private DeviceRepository deviceRepository;
    
    @Autowired
    private EventService eventService;
    
    public Device registerDevice(Device device) {
        // Custom validation
        validateDevice(device);
        
        // Save device
        Device savedDevice = deviceRepository.save(device);
        
        // Create audit event
        eventService.createEvent(
            EventType.DEVICE_REGISTERED,
            savedDevice.getId(),
            "Device registered successfully"
        );
        
        return savedDevice;
    }
    
    private void validateDevice(Device device) {
        // Custom validation logic
        if (device.getSerialNumber() == null) {
            throw new IllegalArgumentException("Serial number is required");
        }
    }
}
```

## Health Monitoring

Monitor your OpenFrame application health:

```bash
# Check overall health
curl http://localhost:8080/actuator/health

# Check specific components
curl http://localhost:8080/actuator/health/mongo
curl http://localhost:8080/actuator/health/redis

# View application metrics
curl http://localhost:8080/actuator/metrics
```

## Best Practices

### 1. **Use DTOs for API Responses**
```java
// Good: Use OpenFrame DTOs
public DeviceResponse getDevice(@PathVariable String id) {
    Device device = deviceRepository.findById(id)
        .orElseThrow(() -> new DeviceNotFoundException(id));
    return DeviceMapper.toResponse(device);
}
```

### 2. **Implement Proper Error Handling**
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleDeviceNotFound(DeviceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse("DEVICE_NOT_FOUND", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }
}
```

### 3. **Use Cursor Pagination**
```java
public PageResponse<DeviceResponse> getDevices(
    @RequestParam(defaultValue = "20") int limit,
    @RequestParam(required = false) String cursor
) {
    CursorPaginationInput pagination = new CursorPaginationInput(limit, cursor);
    return deviceService.getDevices(pagination);
}
```

## Where to Get Help

### Documentation
- **[Architecture Overview](../reference/architecture/overview.md)** - Deep dive into system architecture
- **[API Reference](../reference/)** - Complete API documentation
- **[Development Guide](../development/README.md)** - Best practices and patterns

### Community Support
- **[OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)** - Active community support
- **[OpenFrame Platform](https://openframe.ai)** - Product documentation and guides
- **[Flamingo](https://flamingo.run)** - Company information and mission

### Learning Resources

[![OpenFrame v0.3.7 - Enhanced Developer Experience](https://img.youtube.com/vi/O8hbBO5Mym8/maxresdefault.jpg)](https://www.youtube.com/watch?v=O8hbBO5Mym8)

## Next Steps

### Immediate Next Steps
1. **[Development Setup](../development/setup/environment.md)** - Set up your development environment
2. **[Local Development](../development/setup/local-development.md)** - Learn about development workflow
3. **[Architecture Guide](../development/architecture/overview.md)** - Understand system architecture

### Advanced Topics
- **Multi-tenant Configuration** - Set up tenant isolation
- **OAuth Integration** - Configure SSO providers
- **Event Streaming** - Implement real-time event processing
- **Custom Extensions** - Build custom integrations

### Production Readiness
- **Security Hardening** - Production security configuration
- **Performance Optimization** - Database indexing and caching
- **Monitoring & Alerting** - Application monitoring setup

## Summary

You now have a solid foundation with OpenFrame OSS Library! You've explored:

✅ **Device Management** - Multi-type device tracking and inventory  
✅ **Organization Setup** - Multi-tenant organization structure  
✅ **Event & Audit System** - Comprehensive tracking and logging  
✅ **Security Features** - JWT authentication and authorization  
✅ **Tool Integration** - External tool connection capabilities  

Continue your journey by diving deeper into the [Development Guide](../development/README.md) or exploring specific [API modules](../reference/architecture/overview.md).

Happy building with OpenFrame! 🚀