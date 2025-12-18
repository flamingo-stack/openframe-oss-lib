# Common Use Cases for OpenFrame OSS

This guide covers the most common scenarios and practical examples of using OpenFrame OSS in real-world environments.

## Overview of Use Cases

OpenFrame OSS excels in enterprise environments where you need to manage devices, organizations, and users at scale. Here are the top use cases:

## 1. 🏢 Multi-Tenant SaaS Platform

**Scenario:** You're building a SaaS application that serves multiple customers, each needing isolated data and user management.

### How to Implement

**Step 1: Create Organizations for Each Customer**

```bash
# Create organization for Customer A
curl -X POST http://localhost:8080/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Acme Corporation",
    "address": {
      "street": "123 Business Ave",
      "city": "New York",
      "state": "NY",
      "country": "US",
      "postalCode": "10001"
    },
    "contactInformation": {
      "email": "admin@acme.com",
      "phone": "+1-555-0123",
      "website": "https://acme.com"
    },
    "contactPerson": {
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@acme.com",
      "phone": "+1-555-0124"
    }
  }'
```

**Step 2: Set Up User Roles**

```bash
# Invite organization admin
curl -X POST http://localhost:8080/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "admin@acme.com",
    "organizationId": "org_12345",
    "role": "ORGANIZATION_ADMIN",
    "message": "Welcome to your OpenFrame organization!"
  }'
```

**Best Practices:**
- Use organization-scoped API keys for customer integrations
- Implement proper data isolation at the database level
- Set up monitoring per organization for billing and usage tracking
- Configure backup strategies per tenant

## 2. 🖥️ Device Fleet Management

**Scenario:** Managing a large fleet of IoT devices, servers, or workstations across multiple locations.

### Device Lifecycle Management

**Register New Devices:**

```bash
# Bulk device registration
curl -X POST http://localhost:8080/devices/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "devices": [
      {
        "machineId": "device_001",
        "name": "Main Office Router",
        "type": "NETWORK_DEVICE",
        "location": "New York Office",
        "tags": ["critical", "network", "office-ny"]
      },
      {
        "machineId": "device_002", 
        "name": "Warehouse Sensor",
        "type": "IOT_SENSOR",
        "location": "Warehouse A",
        "tags": ["sensor", "warehouse", "temperature"]
      }
    ]
  }'
```

**Monitor Device Status:**

```bash
# Get devices with filtering
curl -G http://localhost:8080/devices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "status=ONLINE" \
  -d "tags=critical" \
  -d "limit=50"
```

**Update Device Status:**

```bash
# Update device when it comes online
curl -X PATCH http://localhost:8080/devices/device_001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00Z",
    "metadata": {
      "cpuUsage": 45,
      "memoryUsage": 67,
      "diskUsage": 23
    }
  }'
```

**Tips for Device Management:**
- Use meaningful device tags for easy filtering and grouping
- Implement automated health checks and status updates
- Set up alerts for critical device failures
- Use device metadata for monitoring and troubleshooting

## 3. 🔐 API Gateway and Access Management

**Scenario:** Providing secure API access to third-party integrations and internal services.

### API Key Management

**Create API Keys for Different Access Levels:**

```bash
# Create read-only API key for analytics service
curl -X POST http://localhost:8080/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Analytics Dashboard",
    "description": "Read-only access for dashboard analytics",
    "permissions": ["READ_DEVICES", "READ_ORGANIZATIONS"],
    "organizationId": "org_12345",
    "expiresAt": "2024-12-31T23:59:59Z"
  }'
```

**Rate Limiting and Usage Tracking:**

```bash
# Check API usage statistics
curl -X GET http://localhost:8080/api-keys/ak_67890/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 4. 📊 Audit and Compliance Logging

**Scenario:** Meeting compliance requirements with comprehensive activity logging.

### Retrieve Audit Logs

```bash
# Get audit logs with filters
curl -G http://localhost:8080/logs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "organizationId=org_12345" \
  -d "eventType=DEVICE_UPDATED" \
  -d "fromDate=2024-01-01T00:00:00Z" \
  -d "toDate=2024-01-15T23:59:59Z" \
  -d "limit=100"
```

**Response Example:**
```json
{
  "logs": [
    {
      "id": "log_123",
      "timestamp": "2024-01-15T10:30:00Z",
      "eventType": "DEVICE_UPDATED",
      "userId": "user_456",
      "organizationId": "org_12345",
      "details": {
        "deviceId": "device_001",
        "changes": {
          "status": {"from": "OFFLINE", "to": "ONLINE"}
        }
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "OpenFrame Agent/1.0"
    }
  ],
  "totalCount": 150,
  "hasMore": true
}
```

## 5. 🔧 Remote Configuration Management

**Scenario:** Deploying configuration changes to devices across your fleet.

### Configuration Deployment

**Create Configuration Templates:**

```bash
# Upload configuration template
curl -X POST http://localhost:8080/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Production Network Config",
    "description": "Standard network configuration for production devices",
    "template": {
      "networkSettings": {
        "dns": ["8.8.8.8", "8.8.4.4"],
        "proxy": "proxy.company.com:8080",
        "timeServers": ["time.company.com"]
      },
      "securitySettings": {
        "enableFirewall": true,
        "allowedPorts": [22, 80, 443, 8080]
      }
    },
    "tags": ["production", "network"]
  }'
```

**Deploy to Devices:**

```bash
# Deploy configuration to tagged devices
curl -X POST http://localhost:8080/configurations/config_789/deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "targetDevices": {
      "tags": ["production", "router"],
      "excludeTags": ["maintenance"]
    },
    "scheduledAt": "2024-01-16T02:00:00Z",
    "rolloutStrategy": "ROLLING",
    "batchSize": 10
  }'
```

## 6. 👥 Team Collaboration and User Management

**Scenario:** Managing team access and permissions across different organizational levels.

### User Invitation and Role Management

**Invite Team Members:**

```bash
# Invite multiple users with different roles
curl -X POST http://localhost:8080/invitations/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "invitations": [
      {
        "email": "developer@company.com",
        "role": "DEVELOPER",
        "permissions": ["READ_DEVICES", "UPDATE_CONFIGURATIONS"],
        "message": "Welcome to the development team!"
      },
      {
        "email": "support@company.com", 
        "role": "SUPPORT",
        "permissions": ["READ_DEVICES", "READ_LOGS"],
        "message": "Welcome to the support team!"
      }
    ]
  }'
```

## Troubleshooting Common Issues

### Authentication Problems

**Issue:** API calls returning 401 Unauthorized

**Solutions:**
1. **Check Token Expiry:**
   ```bash
   # Decode JWT to check expiration
   echo "YOUR_JWT_TOKEN" | base64 -d | jq .exp
   ```

2. **Refresh Token:**
   ```bash
   curl -X POST http://localhost:8080/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
   ```

### Performance Optimization

**Issue:** Slow API responses with large datasets

**Solutions:**
1. **Use Pagination:**
   ```bash
   curl -G http://localhost:8080/devices \
     -d "limit=50" \
     -d "cursor=eyJpZCI6IjEyMyJ9"
   ```

2. **Apply Filters:**
   ```bash
   curl -G http://localhost:8080/logs \
     -d "organizationId=specific_org" \
     -d "eventType=DEVICE_UPDATED" \
     -d "limit=25"
   ```

### Data Consistency Issues

**Issue:** Stale device status or missing events

**Solutions:**
1. **Force Device Sync:**
   ```bash
   curl -X POST http://localhost:8080/devices/device_001/sync \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Check Event Processing:**
   ```bash
   curl -X GET http://localhost:8080/events/processing-status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Best Practices Summary

| Category | Best Practice | Why It Matters |
|----------|---------------|----------------|
| **Security** | Use API keys with minimal required permissions | Reduces attack surface and limits potential damage |
| **Performance** | Implement pagination for large datasets | Improves response times and reduces memory usage |
| **Monitoring** | Set up health checks for all critical devices | Enables proactive issue resolution |
| **Data Management** | Regular backup and archival of audit logs | Ensures compliance and data recovery capability |
| **Access Control** | Use role-based permissions with team separation | Maintains security while enabling collaboration |

## Advanced Integration Examples

<details>
<summary><strong>Webhooks for Real-time Notifications</strong></summary>

```bash
# Set up webhook for device status changes
curl -X POST http://localhost:8080/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "https://your-app.com/webhooks/device-status",
    "events": ["device.status.changed", "device.offline"],
    "secret": "webhook_secret_key",
    "active": true
  }'
```

</details>

<details>
<summary><strong>Bulk Operations for Large Deployments</strong></summary>

```bash
# Bulk update device configurations
curl -X POST http://localhost:8080/devices/bulk-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "filter": {
      "tags": ["production", "server"],
      "organizationId": "org_12345"
    },
    "updates": {
      "configuration": "config_789",
      "tags": {
        "add": ["updated_2024"],
        "remove": ["legacy"]
      }
    }
  }'
```

</details>

---

**Ready for More?**
- 🏗️ Learn about [Developer Architecture](../dev/architecture-overview-dev.md)
- 🚀 Explore [Advanced Deployment Strategies](../dev/getting-started-dev.md)
- 📖 Check the [API Reference Documentation](https://docs.openframe.dev/api)

*This guide covers common patterns. For specific integration needs, consult our developer documentation or community forums.*