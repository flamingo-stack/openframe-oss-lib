# Common Use Cases for OpenFrame OSS Library

This guide covers the most common scenarios and workflows when using OpenFrame OSS Library in your organization.

## Overview of Primary Use Cases

The OpenFrame platform is designed to handle several key business scenarios:

1. **Organization Management** - Setting up and managing multiple organizations
2. **Device Monitoring** - Tracking devices across your infrastructure  
3. **Event Processing** - Monitoring and filtering system events
4. **Agent Management** - Deploying and managing monitoring agents
5. **Audit Logging** - Tracking changes and activities
6. **User Access Control** - Managing user permissions and authentication

---

## Use Case 1: Managing Multiple Organizations

### Scenario
You need to manage multiple client organizations, each with their own devices, users, and configurations.

### Step-by-Step Process

**1. Create a New Organization**
```bash
curl -X POST http://localhost:8080/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "organizationId": "ACME-2024",
    "category": "Manufacturing", 
    "numberOfEmployees": 150,
    "monthlyRevenue": 75000.00,
    "contractStartDate": "2024-01-15",
    "contactInformation": {
      "email": "admin@acme.com",
      "phone": "+1-555-0199",
      "contactPerson": {
        "firstName": "John",
        "lastName": "Smith",
        "title": "IT Director"
      },
      "address": {
        "street": "123 Business Ave",
        "city": "Enterprise City",
        "state": "CA",
        "zipCode": "90210",
        "country": "USA"
      }
    }
  }'
```

**2. List All Organizations**
```bash
curl "http://localhost:8080/api/organizations?page=0&size=20"
```

**3. Filter Organizations by Category**
```bash
curl "http://localhost:8080/api/organizations?category=Manufacturing&page=0&size=10"
```

### Best Practices
- Use consistent naming conventions for organizationId (e.g., COMPANY-YEAR format)
- Always include complete contact information for support purposes
- Set appropriate employee count ranges for resource planning
- Use the `isDefault` flag carefully - only one organization should be default

---

## Use Case 2: Device Monitoring and Filtering

### Scenario
Monitor devices across multiple locations and filter them based on various criteria like tags, status, or organization.

### Step-by-Step Process

**1. Query Devices with Filters**
```bash
curl -X POST http://localhost:8080/api/devices/search \
  -H "Content-Type: application/json" \
  -d '{
    "deviceFilters": {
      "organizationIds": ["ACME-2024"],
      "tagFilters": [
        {
          "key": "environment", 
          "values": ["production", "staging"]
        },
        {
          "key": "location",
          "values": ["datacenter-1"]
        }
      ]
    },
    "pageSize": 50,
    "cursor": null
  }'
```

**2. Get Device Count by Organization**
```bash
curl -X POST http://localhost:8080/api/devices/count \
  -H "Content-Type: application/json" \
  -d '{
    "deviceFilters": {
      "organizationIds": ["ACME-2024"]
    }
  }'
```

**3. Filter by Multiple Criteria**
```bash
curl -X POST http://localhost:8080/api/devices/search \
  -H "Content-Type: application/json" \
  -d '{
    "deviceFilters": {
      "organizationIds": ["ACME-2024", "CORP-2024"],
      "tagFilters": [
        {
          "key": "status",
          "values": ["active"]
        }
      ]
    }
  }'
```

### Tips and Tricks
- **Use pagination**: Always implement pagination for large device lists
- **Tag strategically**: Use consistent tag naming conventions (environment, location, team, etc.)
- **Monitor trends**: Regularly check device counts to track infrastructure growth
- **Filter efficiently**: Combine multiple filter criteria to narrow down results

---

## Use Case 3: Event Processing and Monitoring  

### Scenario
Track system events, filter by type or user, and maintain audit trails for compliance.

### Step-by-Step Process

**1. Query Recent Events**
```bash
curl -X POST http://localhost:8080/api/events/search \
  -H "Content-Type: application/json" \
  -d '{
    "eventFilters": {
      "organizationIds": ["ACME-2024"],
      "eventTypes": ["DEVICE_REGISTRATION", "USER_LOGIN", "CONFIG_CHANGE"],
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-12-31T23:59:59Z"
    },
    "pageSize": 100
  }'
```

**2. Filter Events by Specific User**
```bash
curl -X POST http://localhost:8080/api/events/search \
  -H "Content-Type: application/json" \
  -d '{
    "eventFilters": {
      "userIds": ["john.smith@acme.com"],
      "eventTypes": ["LOGIN_ATTEMPT", "PERMISSION_CHANGE"]
    }
  }'
```

**3. Get Event Summary/Count**
```bash
curl -X POST http://localhost:8080/api/events/summary \
  -H "Content-Type: application/json" \
  -d '{
    "eventFilters": {
      "organizationIds": ["ACME-2024"],
      "startDate": "2024-01-01T00:00:00Z"
    }
  }'
```

### Best Practices
- **Set appropriate time ranges**: Don't query unlimited date ranges
- **Use specific event types**: Filter by relevant event types to reduce noise
- **Implement alerting**: Set up notifications for critical events
- **Regular cleanup**: Archive old events to maintain performance

---

## Use Case 4: Agent Registration and Management

### Scenario
Deploy monitoring agents across your infrastructure and manage their lifecycle.

### Step-by-Step Process

**1. Register a New Agent (Fleet MDM)**
```bash
curl -X POST http://localhost:8080/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "installationMethod": "MANUAL",
    "client": "fleet-client-1",
    "site": "main-datacenter",
    "agentType": "FLEET_MDM",
    "organizationId": "ACME-2024",
    "hostInfo": {
      "hostname": "server-01.acme.com",
      "platform": "linux",
      "architecture": "x86_64"
    }
  }'
```

**2. List Active Agents**
```bash
curl "http://localhost:8080/api/agents?organizationId=ACME-2024&status=ACTIVE"
```

**3. Force Tool Installation on Agents**
```bash
curl -X POST http://localhost:8080/api/agents/install-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "monitoring-tool-v2",
    "machineIds": ["server-01", "server-02", "server-03"],
    "organizationId": "ACME-2024",
    "installationParams": {
      "autoStart": true,
      "configFile": "/etc/monitoring/config.yml"
    }
  }'
```

### Management Tips
- **Standardize naming**: Use consistent hostname patterns
- **Group by purpose**: Tag agents by function (web, database, monitoring)
- **Monitor health**: Regularly check agent connectivity and status
- **Version control**: Track agent versions and plan updates systematically

---

## Use Case 5: Audit Log Management

### Scenario
Maintain comprehensive audit trails for compliance and security monitoring.

### Step-by-Step Process

**1. Query Audit Logs**
```bash
curl -X POST http://localhost:8080/api/audit/logs \
  -H "Content-Type: application/json" \
  -d '{
    "logFilters": {
      "organizationFilterOptions": [
        {"organizationId": "ACME-2024", "organizationName": "Acme Corporation"}
      ],
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T23:59:59Z",
      "logLevel": "INFO"
    }
  }'
```

**2. Filter by Specific Actions**
```bash
curl -X POST http://localhost:8080/api/audit/logs \
  -H "Content-Type: application/json" \
  -d '{
    "logFilters": {
      "organizationFilterOptions": [
        {"organizationId": "ACME-2024"}
      ],
      "actionTypes": ["CREATE", "UPDATE", "DELETE"],
      "resourceTypes": ["ORGANIZATION", "USER", "DEVICE"]
    }
  }'
```

### Compliance Best Practices
- **Retain logs appropriately**: Follow your organization's data retention policies
- **Regular exports**: Export audit logs for external compliance systems
- **Monitor critical actions**: Set up alerts for sensitive operations
- **Document access**: Keep records of who accesses audit logs and when

---

## Use Case 6: User Authentication and Access Control

### Scenario
Manage user access across organizations using OAuth providers like Microsoft.

### Step-by-Step Process

**1. Configure OAuth Client Registration**
```bash
# This is typically done via configuration, but can be managed via API
curl -X POST http://localhost:8080/api/auth/oauth/clients \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "microsoft",
    "clientId": "your-app-client-id",
    "organizationId": "ACME-2024",
    "redirectUris": ["https://your-app.com/auth/callback"],
    "scopes": ["openid", "profile", "email"]
  }'
```

**2. User Search and Management**
```bash
curl "http://localhost:8080/api/users?email=john.smith@acme.com&organizationId=ACME-2024"
```

### Access Control Tips
- **Use organization-specific OAuth**: Configure separate OAuth apps per organization when needed
- **Implement proper scopes**: Only request necessary OAuth scopes
- **Monitor authentication**: Track login patterns and failed attempts
- **Regular access review**: Periodically audit user permissions

---

## Troubleshooting Common Issues

<details>
<summary>API Returns Empty Results</summary>

**Symptoms**: API calls return empty arrays or zero counts

**Solutions**:
1. Verify organization IDs are correct and exist
2. Check date ranges in filters aren't too restrictive
3. Ensure the user has proper permissions for the requested data
4. Verify database connectivity and data presence
</details>

<details>
<summary>Slow Query Performance</summary>

**Symptoms**: API calls take a long time to respond

**Solutions**:
1. Add pagination to large result sets
2. Use more specific filters to reduce query scope
3. Check MongoDB indexes are properly configured
4. Consider caching for frequently accessed data
</details>

<details>
<summary>Authentication Failures</summary>

**Symptoms**: OAuth login fails or returns invalid credentials

**Solutions**:
1. Verify OAuth client configuration matches provider settings
2. Check redirect URIs are properly configured
3. Ensure proper scopes are requested
4. Validate client secrets and IDs
</details>

## Next Steps

Now that you understand the common use cases:

1. **Customize for your needs**: Adapt these examples to your specific requirements
2. **Implement monitoring**: Set up dashboards and alerts based on the data you're collecting
3. **Automate workflows**: Create scripts or integrations to automate repetitive tasks
4. **Scale considerations**: Plan for growth in organizations, devices, and events

For more technical implementation details, see the [Developer Guide](../dev/getting-started-dev.md).