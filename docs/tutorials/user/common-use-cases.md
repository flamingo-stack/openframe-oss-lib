# OpenFrame Common Use Cases

This guide covers the most common scenarios and practical usage patterns for OpenFrame. Each use case includes step-by-step instructions and real-world examples.

## Overview

OpenFrame excels in several key areas:
- **Device Fleet Management**: Track and monitor devices across your organization
- **Multi-tenant Organization Management**: Manage multiple organizations with isolation
- **Integration Hub**: Connect various tools and systems in your infrastructure
- **Event Streaming**: Real-time data processing and notifications
- **Audit and Compliance**: Comprehensive logging and monitoring

---

## Use Case 1: Setting Up Device Fleet Management

**Scenario**: You need to track laptops, servers, and mobile devices across multiple departments.

### Step-by-Step Process

1. **Create Department Organizations**
```bash
# Create IT Department
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IT Department",
    "category": "Internal",
    "numberOfEmployees": 15,
    "contactInformation": {
      "email": "it@company.com",
      "phoneNumber": "+1-555-0101"
    }
  }'

# Create Sales Department
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Department", 
    "category": "Internal",
    "numberOfEmployees": 25,
    "contactInformation": {
      "email": "sales@company.com",
      "phoneNumber": "+1-555-0102"
    }
  }'
```

2. **Register Devices by Type**
```bash
# Register a laptop
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "laptop-it-001",
    "deviceType": "LAPTOP",
    "osType": "WINDOWS",
    "organizationId": "it-dept-org-id",
    "tags": ["critical", "development"]
  }'

# Register a server
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "srv-prod-001",
    "deviceType": "SERVER", 
    "osType": "LINUX",
    "organizationId": "it-dept-org-id",
    "tags": ["production", "database"]
  }'
```

3. **Query Devices with Filters**
```bash
# Get all Windows laptops
curl "http://localhost:8080/api/devices?deviceType=LAPTOP&osType=WINDOWS"

# Get devices by organization
curl "http://localhost:8080/api/devices?organizationId=it-dept-org-id"

# Get devices with specific tags
curl "http://localhost:8080/api/devices?tags=critical,production"
```

### Best Practices for Device Management
- Use consistent naming conventions (`deviceType-dept-number`)
- Apply meaningful tags for easy filtering
- Regular health checks and status updates
- Maintain device metadata (location, owner, purpose)

---

## Use Case 2: Multi-Tenant SaaS Platform

**Scenario**: You're running a SaaS platform and need to isolate customer data and track usage.

### Implementation Steps

1. **Create Customer Organizations**
```bash
# Customer A
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "category": "Customer",
    "numberOfEmployees": 500,
    "websiteUrl": "https://acme-corp.com",
    "monthlyRevenue": 50000.00,
    "contractStartDate": "2024-01-01",
    "contractEndDate": "2024-12-31",
    "contactInformation": {
      "email": "admin@acme-corp.com",
      "phoneNumber": "+1-555-1001"
    }
  }'
```

2. **Track Customer Resources**
```bash
# Register customer's application instances
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "acme-app-instance-1",
    "deviceType": "APPLICATION",
    "osType": "CONTAINER",
    "organizationId": "acme-corp-org-id",
    "tags": ["customer-facing", "production", "tier-premium"]
  }'
```

3. **Monitor Usage and Events**
```bash
# Query customer-specific events
curl "http://localhost:8080/api/events?organizationId=acme-corp-org-id&from=2024-01-01"

# Get organization metrics
curl "http://localhost:8080/api/organizations/acme-corp-org-id/metrics"
```

### SaaS-Specific Tips
- Use organization IDs for tenant isolation
- Track contract dates for billing cycles
- Monitor resource usage per customer
- Set up alerts for contract renewals

---

## Use Case 3: Infrastructure Integration Hub

**Scenario**: Connect OpenFrame with your existing monitoring and management tools.

### Integration Examples

1. **Database Monitoring Integration**
```bash
# Register monitoring tools as integrated services
curl -X POST http://localhost:8080/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "toolType": "PROMETHEUS",
    "name": "Production Prometheus",
    "endpoint": "http://prometheus.internal:9090",
    "organizationId": "it-dept-org-id"
  }'

# Register databases
curl -X POST http://localhost:8080/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "toolType": "MONGODB",
    "name": "User Database",
    "endpoint": "mongodb://prod-mongo:27017",
    "organizationId": "it-dept-org-id"
  }'
```

2. **Event Streaming Setup**
```yaml
# Configure Kafka topics for different event types
openframe:
  kafka:
    topics:
      device-events: device.events
      audit-logs: audit.logs
      metrics: system.metrics
```

3. **Authentication Integration**
```bash
# Configure Authentik SSO
curl -X POST http://localhost:8080/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "toolType": "AUTHENTIK",
    "name": "Company SSO",
    "endpoint": "https://auth.company.com",
    "organizationId": "main-org-id"
  }'
```

### Integration Patterns
- Use consistent tool naming conventions
- Configure health checks for all integrated services
- Set up event forwarding to external systems
- Implement proper error handling and retries

---

## Use Case 4: Compliance and Audit Logging

**Scenario**: Meet compliance requirements with comprehensive audit trails.

### Implementation

1. **Enable Comprehensive Logging**
```yaml
# application.yml
logging:
  level:
    com.openframe.api: INFO
    com.openframe.data.aspect: DEBUG
    
openframe:
  audit:
    enabled: true
    include-request-body: true
    include-response-body: false
    sensitive-fields: ["password", "token", "secret"]
```

2. **Query Audit Logs**
```bash
# Get organization access logs
curl "http://localhost:8080/api/audit/logs?organizationId=customer-org&from=2024-01-01&to=2024-01-31"

# Search for specific actions
curl "http://localhost:8080/api/audit/logs?action=CREATE_DEVICE&userId=admin@company.com"

# Get failed login attempts
curl "http://localhost:8080/api/audit/logs?eventType=AUTHENTICATION_FAILED&from=2024-01-01"
```

3. **Generate Compliance Reports**
```bash
# Export audit logs for compliance
curl "http://localhost:8080/api/audit/export?format=CSV&organizationId=customer-org&from=2024-01-01&to=2024-12-31" \
  -o "audit-report-2024.csv"
```

---

## Use Case 5: Real-Time Monitoring Dashboard

**Scenario**: Create a real-time dashboard showing device status and system health.

### Dashboard Setup

1. **Configure Real-Time Data Sources**
```bash
# Enable real-time device status updates
curl -X PUT http://localhost:8080/api/devices/laptop-it-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00Z",
    "healthScore": 95,
    "metadata": {
      "cpuUsage": "25%",
      "memoryUsage": "60%",
      "diskSpace": "40%"
    }
  }'
```

2. **Query Dashboard Data**
```bash
# Get device status summary
curl "http://localhost:8080/api/devices/summary?groupBy=status"

# Get organizational metrics
curl "http://localhost:8080/api/organizations/metrics?timeRange=24h"

# Get real-time events
curl "http://localhost:8080/api/events/stream" # Server-Sent Events
```

3. **Set Up Alerts**
```bash
# Configure device offline alerts
curl -X POST http://localhost:8080/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Device Offline Alert",
    "condition": "device.status == OFFLINE AND device.lastSeen > 1h",
    "action": "SEND_EMAIL",
    "recipients": ["ops@company.com"]
  }'
```

---

## Use Case 6: Automated Device Onboarding

**Scenario**: Automatically register new devices joining your network.

### Automation Setup

1. **Generate Registration Secrets**
```bash
# Generate a secret for automatic registration
curl -X POST http://localhost:8080/api/agent/registration-secret \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "it-dept-org-id",
    "expiresIn": "7d",
    "deviceType": "LAPTOP",
    "tags": ["auto-registered"]
  }'
```

2. **Device Registration Script** (for new devices)
```bash
#!/bin/bash
# Auto-registration script for new devices

DEVICE_ID=$(hostname)
REGISTRATION_SECRET="your-generated-secret"
OS_TYPE=$(uname -s)

curl -X POST http://localhost:8080/api/devices/auto-register \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_ID\",
    \"osType\": \"$OS_TYPE\", 
    \"registrationSecret\": \"$REGISTRATION_SECRET\",
    \"metadata\": {
      \"autoRegistered\": true,
      \"registrationTime\": \"$(date -Iseconds)\"
    }
  }"
```

3. **Validation and Approval Workflow**
```bash
# List pending device registrations
curl "http://localhost:8080/api/devices?status=PENDING_APPROVAL"

# Approve a device
curl -X PUT http://localhost:8080/api/devices/new-device-001/approve \
  -H "Content-Type: application/json"
```

---

## Tips and Tricks

### Performance Optimization
- Use pagination for large datasets (`?page=0&size=20`)
- Implement caching for frequently accessed organization data
- Use device tags for efficient filtering instead of complex queries
- Batch operations when registering multiple devices

### Monitoring Best Practices
- Set up health checks for all critical components
- Monitor API response times and error rates
- Track device registration trends and patterns
- Alert on unusual authentication patterns

### Data Organization
- Use consistent naming conventions across organizations
- Implement tag taxonomies for better device categorization
- Regular cleanup of old or inactive devices
- Archive historical data periodically

### Security Tips
- Rotate registration secrets regularly
- Monitor for unauthorized device registrations
- Implement IP whitelisting for sensitive operations
- Use strong authentication for administrative functions

## Troubleshooting Common Issues

| Problem | Symptoms | Solution |
|---------|----------|----------|
| Slow API responses | High response times | Add database indexes, implement caching |
| Device registration failures | 400/500 errors | Check registration secret validity, verify organization exists |
| Missing audit logs | Empty log queries | Verify audit logging is enabled, check date ranges |
| Integration timeouts | Tool connectivity errors | Check network connectivity, verify endpoints |
| High memory usage | OutOfMemory errors | Tune JVM settings, implement data pagination |

> **Performance Tip**: Use the `/api/devices/filters` endpoint to get available filter options before querying large device lists.

---

## Real-World Examples

### E-commerce Company
- 500+ devices across 5 offices
- Separate organizations for each department
- Integration with existing monitoring (Prometheus, Grafana)
- Automated compliance reporting

### MSP (Managed Service Provider)
- 50+ customer organizations
- Automated device onboarding per customer
- Real-time monitoring dashboards
- SLA tracking and reporting

### Healthcare Organization
- HIPAA compliance requirements
- Device tracking in multiple facilities
- Integration with medical device management
- Comprehensive audit logging

Each scenario demonstrates OpenFrame's flexibility in adapting to different organizational needs and compliance requirements.

---

*For more advanced configurations and custom integrations, refer to the developer documentation and API reference guides.*