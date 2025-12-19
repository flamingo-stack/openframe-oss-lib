# Common Use Cases for OpenFrame

This guide covers the most common ways to use OpenFrame for device and organization management. Each use case includes step-by-step instructions and practical examples.

## Table of Contents

1. [Managing Organizations](#managing-organizations)
2. [Device Registration and Management](#device-registration-and-management)  
3. [User Access and Invitations](#user-access-and-invitations)
4. [API Integration and Tools](#api-integration-and-tools)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Security and Authentication](#security-and-authentication)

---

## Managing Organizations

Organizations are the top-level containers for devices and users in OpenFrame.

### Creating a New Organization

**When to use**: Setting up a new client, department, or business unit.

<details>
<summary><strong>Step-by-step instructions</strong></summary>

1. **Navigate to Organizations**
   - Access the Organizations section in your OpenFrame dashboard
   - Click "Create New Organization"

2. **Fill in Basic Information**
   ```
   Organization Name: Acme Corporation
   Description: Main corporate IT infrastructure
   ```

3. **Add Contact Information**
   ```
   Primary Contact: john.doe@acme.com
   Phone: +1-555-0199
   ```

4. **Set Address Details**
   ```
   Street: 1234 Corporate Blvd
   City: San Francisco
   State: CA
   Zip: 94105
   Country: USA
   ```

5. **Configure Organization Settings**
   - Set timezone: `America/Los_Angeles`
   - Choose subscription plan
   - Enable/disable features as needed

</details>

**Result**: New organization ready for device enrollment and user management.

### Updating Organization Details

**When to use**: Company moves, contact changes, or policy updates.

**Quick steps**:
1. Find organization in the list
2. Click "Edit" or the organization name
3. Update required fields
4. Save changes

> **💡 Tip**: Use the organization slug (URL-friendly name) for API integrations to avoid issues with name changes.

---

## Device Registration and Management

Devices are the core entities managed within organizations.

### Registering Your First Device

**When to use**: Adding new computers, servers, or IoT devices to management.

<details>
<summary><strong>Device Registration Process</strong></summary>

1. **Generate Registration Secret**
   ```bash
   curl -X POST http://localhost:8080/agent-registration-secrets \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"organizationId": "org-123", "description": "Web servers"}'
   ```

2. **Install Agent on Target Device**
   ```bash
   # Download agent
   wget https://releases.openframe.com/agent/latest/openframe-agent-linux.tar.gz
   
   # Extract and install
   tar -xzf openframe-agent-linux.tar.gz
   sudo ./install.sh --secret="REGISTRATION_SECRET"
   ```

3. **Verify Device Appears**
   - Check the Devices section in your dashboard
   - Look for the new device in "Pending" status
   - Approve the device registration

4. **Add Device Tags** (Optional)
   ```
   Environment: Production
   Role: Web Server  
   Location: DC-West-1
   ```

</details>

**Common device types**:
- **Servers**: Production and development servers
- **Workstations**: Employee laptops and desktops  
- **IoT Devices**: Sensors, cameras, embedded systems
- **Network Equipment**: Routers, switches, access points

### Device Status Monitoring

**When to use**: Keeping track of device health and status.

| Status | Description | Action Needed |
|--------|-------------|---------------|
| 🟢 **Online** | Device is connected and reporting | None |
| 🟡 **Warning** | Minor issues detected | Check device logs |
| 🔴 **Offline** | Device not responding | Investigate connection |
| ⚫ **Disabled** | Manually disabled | Re-enable if needed |

**How to check device status**:
1. Go to Devices → Overview  
2. Use status filters to find problematic devices
3. Click on device name for detailed information
4. Review recent events and logs

---

## User Access and Invitations

Manage who can access your organizations and what they can do.

### Inviting New Users

**When to use**: Adding team members, contractors, or external partners.

<details>
<summary><strong>User Invitation Steps</strong></summary>

1. **Send Invitation**
   - Go to Users → Invite User
   - Enter email address: `newuser@company.com`
   - Select role: Admin, Manager, or Viewer
   - Choose organizations they can access
   - Add personal message (optional)

2. **User Accepts Invitation**
   - User receives email with invitation link
   - They click link and create account
   - Account is automatically linked to organization

3. **Configure Permissions**
   - Set device access levels
   - Configure feature permissions
   - Add to specific teams or groups

</details>

### User Role Management

| Role | Permissions | Best For |
|------|-------------|----------|
| **Admin** | Full access, user management | IT administrators |
| **Manager** | Device management, read-only users | Team leads |
| **Viewer** | Read-only access | Contractors, auditors |
| **Operator** | Device operations, no config changes | NOC staff |

**Changing user roles**:
1. Find user in Users list
2. Click on their name
3. Select new role from dropdown
4. Save changes

---

## API Integration and Tools

Connect OpenFrame with your existing tools and workflows.

### Setting Up API Keys  

**When to use**: Automating tasks, integrating with CI/CD, custom applications.

**Steps to create API key**:
1. Go to Settings → API Keys
2. Click "Generate New Key"
3. Set description: "CI/CD Integration"
4. Choose permissions scope
5. Copy and store key securely

**Example API usage**:
```bash
# Get all devices
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8080/api/v1/devices

# Update device status
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "maintenance"}' \
  http://localhost:8080/devices/machine-123
```

### Popular Integration Scenarios

<details>
<summary><strong>Monitoring System Integration</strong></summary>

**Connect with Prometheus/Grafana**:
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'openframe'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: /actuator/prometheus
    bearer_token: 'YOUR_API_TOKEN'
```

**Custom dashboard queries**:
- Device count: `openframe_devices_total`
- Online devices: `openframe_devices_online`
- Organization health: `openframe_organization_health`

</details>

<details>
<summary><strong>Automation with Ansible</strong></summary>

**Inventory plugin configuration**:
```yaml
# openframe_inventory.yml  
plugin: openframe
api_endpoint: http://localhost:8080
api_token: YOUR_TOKEN
groups:
  - environment
  - location
  - device_type
```

**Playbook example**:
```yaml
- name: Update all web servers
  hosts: environment_production:&role_web_server
  tasks:
    - name: Deploy application
      copy:
        src: app.jar
        dest: /opt/app/
```

</details>

---

## Monitoring and Logging

Keep track of what's happening across your devices and infrastructure.

### Setting Up Alerts

**When to use**: Get notified about device issues, security events, or system changes.

**Common alert types**:
- Device goes offline
- High CPU/memory usage  
- Failed login attempts
- Configuration changes
- Certificate expiration

**Creating an alert**:
1. Go to Monitoring → Alerts
2. Click "New Alert Rule"
3. Choose trigger condition
4. Set notification method (email, Slack, webhook)
5. Test and activate

### Log Analysis

**Viewing device logs**:
1. Select device from Devices list
2. Click "Logs" tab  
3. Filter by:
   - Time range
   - Log level (ERROR, WARN, INFO)
   - Source component
   - Search terms

**Log retention**: Logs are kept for 90 days by default. Contact support for longer retention.

---

## Security and Authentication

Protect your OpenFrame deployment and ensure secure access.

### SSO Integration

**When to use**: Large organizations with existing identity providers.

**Supported providers**:
- Active Directory / LDAP
- SAML 2.0 (Okta, Azure AD, Google)  
- OAuth 2.0 / OpenID Connect

**Basic SSO setup**:
1. Go to Settings → Authentication
2. Choose provider type
3. Enter provider configuration
4. Test connection
5. Enable for organization

### Security Best Practices

> **🔒 Security Checklist**

- [ ] Use strong, unique passwords
- [ ] Enable two-factor authentication  
- [ ] Rotate API keys regularly (quarterly)
- [ ] Monitor login attempts and failures
- [ ] Keep OpenFrame updated to latest version
- [ ] Use HTTPS in production
- [ ] Limit network access with firewalls
- [ ] Regular security audits of user access

### Certificate Management

**Managing device certificates**:
1. Go to Devices → Certificates
2. Check expiration dates
3. Renew certificates before expiry
4. Update device configurations
5. Verify connectivity after renewal

---

## Troubleshooting Common Issues

### Device Connection Problems

**Symptoms**: Device shows as offline or not reporting data

**Solutions**:
1. Check network connectivity from device
2. Verify agent service is running
3. Check firewall rules allow outbound connections
4. Validate registration secret hasn't expired
5. Review device logs for error messages

### Performance Issues  

**Symptoms**: Slow dashboard loading, API timeouts

**Solutions**:
1. Check database performance and indexing
2. Monitor system resource usage
3. Review log files for bottlenecks
4. Scale services horizontally if needed
5. Optimize database queries

### Authentication Failures

**Symptoms**: Unable to login, API returns 401/403 errors

**Solutions**:
1. Verify user credentials are correct
2. Check if account is disabled or expired
3. Validate API token is not expired
4. Review SSO configuration if using SSO
5. Check user permissions for requested resources

## Tips and Best Practices

### Organization Structure

- **Use descriptive names**: "West Coast Operations" vs "Org1"
- **Consistent naming**: Follow your company naming conventions
- **Regular cleanup**: Archive unused organizations
- **Access reviews**: Quarterly access reviews for users

### Device Management

- **Tagging strategy**: Use consistent tags across all devices
- **Regular updates**: Keep agent software updated
- **Health monitoring**: Set up proactive alerts
- **Documentation**: Maintain device inventory documentation

### API Usage

- **Rate limiting**: Respect API rate limits to avoid throttling
- **Error handling**: Implement proper retry logic
- **Caching**: Cache frequently accessed data
- **Monitoring**: Monitor API usage and performance

---

## Getting Advanced

Ready for more advanced usage? Check out these resources:

- **Developer Guide**: [Getting Started for Developers](../dev/getting-started-dev.md)
- **Architecture Overview**: [Technical Architecture](../dev/architecture-overview-dev.md)  
- **API Documentation**: Access GraphQL playground at `/graphiql`
- **SDK Documentation**: Language-specific SDKs for integration

Need help? Contact our support team or check the community forums for additional guidance and best practices from other OpenFrame users.