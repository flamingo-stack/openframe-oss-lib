# First Steps with OpenFrame OSS Library

Now that you have OpenFrame running, let's explore the core concepts by building real examples. In this guide, you'll create organizations, manage devices, and process events - the fundamental building blocks of any MSP platform.

## What You'll Learn

By the end of this guide, you'll understand:
- ✅ How to create and manage organizations (multi-tenancy)
- ✅ How to register and monitor devices
- ✅ How to handle events and audit logs  
- ✅ How to integrate with external MSP tools
- ✅ How authentication and authorization work

## Step 1: Understanding the Data Model

OpenFrame uses a hierarchical data model centered around organizations:

```mermaid
graph TD
    A[Organization] --> B[Users]
    A --> C[Devices/Machines]
    A --> D[Tool Connections]
    C --> E[Events]
    C --> F[Alerts]
    C --> G[Compliance]
    D --> H[Installed Agents]
    E --> I[Audit Logs]
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5  
    style E fill:#fff3e0
```

## Step 2: Create Your First Organization

Organizations are the top-level containers that provide multi-tenant isolation.

### Create Organization Service

```java
// src/main/java/com/example/testservice/OrganizationService.java
package com.example.testservice;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.ContactInformation;
import com.openframe.data.document.organization.Address;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class OrganizationService {

    @Autowired
    private MongoTemplate mongoTemplate;

    public Organization createOrganization(String name, String domain, String email, String phone) {
        // Create organization with contact information
        Organization org = new Organization();
        org.setName(name);
        org.setDomain(domain);
        org.setCreatedAt(Instant.now());
        org.setUpdatedAt(Instant.now());

        // Set contact information
        ContactInformation contact = new ContactInformation();
        contact.setEmail(email);
        contact.setPhone(phone);
        org.setContactInformation(contact);

        // Set address
        Address address = new Address();
        address.setCity("Example City");
        address.setState("Example State");
        address.setCountry("US");
        address.setZipCode("12345");
        org.setAddress(address);

        return mongoTemplate.save(org);
    }

    public List<Organization> getAllOrganizations() {
        return mongoTemplate.findAll(Organization.class);
    }

    public Organization findByDomain(String domain) {
        Query query = new Query(Criteria.where("domain").is(domain));
        return mongoTemplate.findOne(query, Organization.class);
    }
}
```

### Add Organization Endpoints

```java
// Add to TestServiceApplication.java
import org.springframework.beans.factory.annotation.Autowired;

@Autowired
private OrganizationService organizationService;

@PostMapping("/organizations")
public Organization createOrganization(@RequestBody CreateOrgRequest request) {
    return organizationService.createOrganization(
        request.getName(),
        request.getDomain(), 
        request.getEmail(),
        request.getPhone()
    );
}

@GetMapping("/organizations")
public List<Organization> getOrganizations() {
    return organizationService.getAllOrganizations();
}

@GetMapping("/organizations/domain/{domain}")
public Organization getByDomain(@PathVariable String domain) {
    return organizationService.findByDomain(domain);
}

// Request DTO
public static class CreateOrgRequest {
    private String name;
    private String domain;
    private String email;
    private String phone;
    
    // Getters and setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
```

### Test Organization Creation

```bash
# Create your first organization
curl -X POST http://localhost:8080/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme MSP",
    "domain": "acme-msp.com",
    "email": "admin@acme-msp.com", 
    "phone": "+1-555-0123"
  }'

# List all organizations  
curl http://localhost:8080/organizations | jq '.'

# Find by domain
curl http://localhost:8080/organizations/domain/acme-msp.com | jq '.'
```

## Step 3: Register Devices

Devices represent the endpoints you're managing - servers, workstations, IoT devices, etc.

### Create Device Service

```java
// src/main/java/com/example/testservice/DeviceService.java
package com.example.testservice;

import com.openframe.data.document.device.Device;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.MachineTag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service  
public class DeviceService {

    @Autowired
    private MongoTemplate mongoTemplate;

    public Device registerDevice(String organizationId, String hostname, String ipAddress, DeviceType type) {
        Device device = new Device();
        device.setHostname(hostname);
        device.setIpAddress(ipAddress);
        device.setDeviceType(type);
        device.setStatus(DeviceStatus.ONLINE);
        device.setOrganizationId(organizationId);
        device.setCreatedAt(Instant.now());
        device.setLastSeenAt(Instant.now());

        return mongoTemplate.save(device);
    }

    public Device addTags(String deviceId, Set<String> tags) {
        Device device = mongoTemplate.findById(deviceId, Device.class);
        if (device != null) {
            // Convert tags to MachineTag objects
            Set<MachineTag> machineTags = tags.stream()
                .map(tag -> {
                    MachineTag machineTag = new MachineTag();
                    machineTag.setTag(tag);
                    machineTag.setCreatedAt(Instant.now());
                    return machineTag;
                })
                .collect(java.util.stream.Collectors.toSet());
            
            device.setMachineTags(machineTags);
            device.setUpdatedAt(Instant.now());
            return mongoTemplate.save(device);
        }
        return null;
    }

    public List<Device> getDevicesByOrganization(String organizationId) {
        Query query = new Query(Criteria.where("organizationId").is(organizationId));
        return mongoTemplate.find(query, Device.class);
    }

    public Device updateStatus(String deviceId, DeviceStatus status) {
        Device device = mongoTemplate.findById(deviceId, Device.class);
        if (device != null) {
            device.setStatus(status);
            device.setLastSeenAt(Instant.now());
            device.setUpdatedAt(Instant.now());
            return mongoTemplate.save(device);
        }
        return null;
    }
}
```

### Add Device Endpoints

```java
// Add to TestServiceApplication.java
@Autowired
private DeviceService deviceService;

@PostMapping("/devices")
public Device registerDevice(@RequestBody RegisterDeviceRequest request) {
    return deviceService.registerDevice(
        request.getOrganizationId(),
        request.getHostname(),
        request.getIpAddress(),
        DeviceType.valueOf(request.getType())
    );
}

@PutMapping("/devices/{deviceId}/tags")
public Device addTags(@PathVariable String deviceId, @RequestBody TagRequest request) {
    return deviceService.addTags(deviceId, request.getTags());
}

@GetMapping("/organizations/{orgId}/devices")
public List<Device> getDevices(@PathVariable String orgId) {
    return deviceService.getDevicesByOrganization(orgId);
}

@PutMapping("/devices/{deviceId}/status") 
public Device updateStatus(@PathVariable String deviceId, @RequestBody StatusRequest request) {
    return deviceService.updateStatus(deviceId, DeviceStatus.valueOf(request.getStatus()));
}

// Request DTOs
public static class RegisterDeviceRequest {
    private String organizationId;
    private String hostname;
    private String ipAddress;
    private String type;
    
    // Getters and setters
    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }
    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}

public static class TagRequest {
    private Set<String> tags;
    public Set<String> getTags() { return tags; }
    public void setTags(Set<String> tags) { this.tags = tags; }
}

public static class StatusRequest {
    private String status;
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
```

### Test Device Management

```bash
# First, get the organization ID from previous step
ORG_ID="<paste-org-id-here>"

# Register a server
curl -X POST http://localhost:8080/devices \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "hostname": "web-server-01",
    "ipAddress": "192.168.1.100", 
    "type": "SERVER"
  }'

# Register a workstation
curl -X POST http://localhost:8080/devices \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "hostname": "john-laptop",
    "ipAddress": "192.168.1.150",
    "type": "LAPTOP"
  }'

# Get device ID from response and add tags
DEVICE_ID="<paste-device-id-here>"

curl -X PUT http://localhost:8080/devices/$DEVICE_ID/tags \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["production", "web-server", "nginx"]
  }'

# List all devices for organization
curl http://localhost:8080/organizations/$ORG_ID/devices | jq '.'
```

## Step 4: Generate Events

Events represent activities, alerts, and changes in your environment.

### Create Event Service

```java
// src/main/java/com/example/testservice/EventService.java
package com.example.testservice;

import com.openframe.data.document.event.CoreEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class EventService {

    @Autowired
    private MongoTemplate mongoTemplate;

    public CoreEvent createEvent(String organizationId, String deviceId, String eventType, 
                               String message, Map<String, Object> metadata) {
        CoreEvent event = new CoreEvent();
        event.setOrganizationId(organizationId);
        event.setDeviceId(deviceId);
        event.setEventType(eventType);
        event.setMessage(message);
        event.setMetadata(metadata);
        event.setTimestamp(Instant.now());
        event.setCreatedAt(Instant.now());

        return mongoTemplate.save(event);
    }

    public List<CoreEvent> getEventsByDevice(String deviceId) {
        Query query = new Query(Criteria.where("deviceId").is(deviceId));
        query.with(org.springframework.data.domain.Sort.by(
            org.springframework.data.domain.Sort.Direction.DESC, "timestamp"));
        return mongoTemplate.find(query, CoreEvent.class);
    }

    public List<CoreEvent> getEventsByOrganization(String organizationId) {
        Query query = new Query(Criteria.where("organizationId").is(organizationId));
        query.with(org.springframework.data.domain.Sort.by(
            org.springframework.data.domain.Sort.Direction.DESC, "timestamp"));
        return mongoTemplate.find(query, CoreEvent.class);
    }
}
```

### Add Event Endpoints

```java
// Add to TestServiceApplication.java
@Autowired
private EventService eventService;

@PostMapping("/events")
public CoreEvent createEvent(@RequestBody CreateEventRequest request) {
    return eventService.createEvent(
        request.getOrganizationId(),
        request.getDeviceId(),
        request.getEventType(),
        request.getMessage(),
        request.getMetadata()
    );
}

@GetMapping("/devices/{deviceId}/events")
public List<CoreEvent> getDeviceEvents(@PathVariable String deviceId) {
    return eventService.getEventsByDevice(deviceId);
}

@GetMapping("/organizations/{orgId}/events")
public List<CoreEvent> getOrgEvents(@PathVariable String orgId) {
    return eventService.getEventsByOrganization(orgId);
}

// Request DTO
public static class CreateEventRequest {
    private String organizationId;
    private String deviceId;
    private String eventType;
    private String message;
    private Map<String, Object> metadata;
    
    // Getters and setters
    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}
```

### Test Event Creation

```bash
# Create some events
curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "deviceId": "'$DEVICE_ID'",
    "eventType": "SYSTEM_STARTUP",
    "message": "Server web-server-01 started successfully",
    "metadata": {
      "service": "nginx",
      "port": 80,
      "status": "healthy"
    }
  }'

curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "deviceId": "'$DEVICE_ID'",
    "eventType": "SECURITY_ALERT",
    "message": "Failed login attempt detected",
    "metadata": {
      "source_ip": "192.168.1.200",
      "user": "admin",
      "attempts": 3
    }
  }'

# View events for device
curl http://localhost:8080/devices/$DEVICE_ID/events | jq '.'

# View all events for organization  
curl http://localhost:8080/organizations/$ORG_ID/events | jq '.'
```

## Step 5: Explore Data Relationships

Let's create a comprehensive example showing how all the pieces fit together:

```bash
# Create a complete MSP environment
echo "🏢 Setting up complete MSP environment..."

# 1. Create organization
ORG_RESPONSE=$(curl -s -X POST http://localhost:8080/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCorp MSP",
    "domain": "techcorp-msp.com",
    "email": "ops@techcorp-msp.com",
    "phone": "+1-555-0199"
  }')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.id')
echo "✅ Created organization: $ORG_ID"

# 2. Register multiple devices
SERVER_RESPONSE=$(curl -s -X POST http://localhost:8080/devices \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "hostname": "db-server-01", 
    "ipAddress": "192.168.1.10",
    "type": "SERVER"
  }')

SERVER_ID=$(echo $SERVER_RESPONSE | jq -r '.id')
echo "✅ Registered database server: $SERVER_ID"

LAPTOP_RESPONSE=$(curl -s -X POST http://localhost:8080/devices \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "hostname": "ceo-macbook",
    "ipAddress": "192.168.1.50", 
    "type": "LAPTOP"
  }')

LAPTOP_ID=$(echo $LAPTOP_RESPONSE | jq -r '.id')
echo "✅ Registered CEO laptop: $LAPTOP_ID"

# 3. Add tags
curl -s -X PUT http://localhost:8080/devices/$SERVER_ID/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["production", "database", "postgresql", "critical"]}'

curl -s -X PUT http://localhost:8080/devices/$LAPTOP_ID/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["executive", "mobile", "macos"]}'

echo "✅ Added device tags"

# 4. Generate realistic events
curl -s -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "deviceId": "'$SERVER_ID'",
    "eventType": "BACKUP_COMPLETED",
    "message": "Database backup completed successfully",
    "metadata": {"backup_size": "2.5GB", "duration": "15min"}
  }' > /dev/null

curl -s -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "deviceId": "'$LAPTOP_ID'",
    "eventType": "VPN_CONNECTED",
    "message": "User connected to company VPN",
    "metadata": {"location": "Remote", "protocol": "WireGuard"}
  }' > /dev/null

echo "✅ Generated sample events"

# 5. Display summary
echo ""
echo "📊 ENVIRONMENT SUMMARY"
echo "====================="
curl -s http://localhost:8080/organizations/$ORG_ID | jq '{name: .name, domain: .domain, id: .id}'
echo ""
echo "📱 DEVICES ($(curl -s http://localhost:8080/organizations/$ORG_ID/devices | jq '. | length')):"
curl -s http://localhost:8080/organizations/$ORG_ID/devices | jq '.[] | {hostname: .hostname, type: .deviceType, status: .status}'
echo ""
echo "🔔 RECENT EVENTS ($(curl -s http://localhost:8080/organizations/$ORG_ID/events | jq '. | length')):"
curl -s http://localhost:8080/organizations/$ORG_ID/events | jq '.[] | {type: .eventType, message: .message, timestamp: .timestamp}'
```

## 🎉 What You've Accomplished

Congratulations! You've successfully:

✅ **Created a multi-tenant organization** with contact details  
✅ **Registered and tagged devices** of different types  
✅ **Generated events** with rich metadata  
✅ **Explored data relationships** between organizations, devices, and events  
✅ **Built a foundation** for MSP platform functionality  

## Key Concepts Learned

### 1. Multi-Tenancy
Organizations provide complete data isolation - each MSP can only see their own devices, events, and users.

### 2. Device Lifecycle
Devices progress through states: Registration → Tagging → Monitoring → Event Generation → Status Updates

### 3. Event-Driven Architecture  
Events capture everything that happens in your environment, providing audit trails and enabling real-time monitoring.

### 4. Flexible Metadata
Both devices and events support arbitrary metadata, allowing customization for specific MSP needs.

## Next Steps & Learning Path

### Immediate Next Steps
1. **[Development Setup](../development/setup/environment.md)** - Configure your IDE for efficient development
2. **[Architecture Deep Dive](../development/architecture/overview.md)** - Understand the full system architecture  
3. **[Testing Guide](../development/testing/overview.md)** - Learn testing patterns and best practices

### Advanced Topics
- **Authentication & Authorization** - Implement JWT-based security
- **Tool Integrations** - Connect FleetDM, Tactical RMM, or other MSP tools
- **Event Streaming** - Set up Kafka for real-time event processing
- **API Security** - Rate limiting, input validation, and threat protection

### Troubleshooting

<details>
<summary>MongoDB Connection Issues</summary>

```bash
# Check MongoDB container
docker logs openframe-mongodb

# Test connection manually
mongosh "mongodb://admin:password123@localhost:27017/?authSource=admin"

# Restart if needed
docker restart openframe-mongodb
```
</details>

<details>
<summary>JSON Parsing Errors</summary>

```bash
# Validate your JSON requests
echo '{"name": "test"}' | jq '.'

# Common issues:
# - Missing quotes around strings
# - Trailing commas
# - Incorrect field names
```
</details>

<details>
<summary>Service Fails to Start</summary>

```bash
# Check for port conflicts
lsof -i :8080

# Review application logs
mvn spring-boot:run | grep ERROR

# Common fixes:
# - Ensure databases are running
# - Check application.yml configuration
# - Verify Java version (should be 21)
```
</details>

## Where to Get Help

- **📖 Documentation**: Continue with [Development Guides](../development/)  
- **🐛 Issues**: [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- **💬 Community**: Join our Discord or Slack channels
- **🎓 Examples**: Browse the `examples/` directory in the repository

---

🚀 **Ready for More?** You now have a solid foundation in OpenFrame OSS Library. Time to explore the development guides and build something amazing!