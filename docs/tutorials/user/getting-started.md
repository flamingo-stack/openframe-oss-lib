# Getting Started with OpenFrame OSS

OpenFrame OSS is an open-source platform for building enterprise device management and API services. This guide will help you get up and running with OpenFrame quickly.

## Prerequisites

Before installing OpenFrame, ensure your system meets these requirements:

| Requirement | Version | Description |
|-------------|---------|-------------|
| Java | 21+ | OpenFrame requires Java 21 or higher |
| Maven | 3.6+ | For building the project |
| MongoDB | 4.4+ | Primary database |
| Kafka | 2.8+ | Message streaming (optional) |
| Docker | 20.10+ | For containerized deployment (recommended) |
| RAM | 4GB+ | Minimum system memory |
| Storage | 10GB+ | For application and data files |

> **Note:** OpenFrame uses Spring Boot 3.3.0 which requires Java 21. Ensure your JAVA_HOME is correctly set.

## Installation Process

```mermaid
flowchart TD
    A[Download OpenFrame] --> B[Install Prerequisites]
    B --> C[Configure Database]
    C --> D[Build Application]
    D --> E[Configure Environment]
    E --> F[Start Services]
    F --> G[Verify Installation]
    G --> H[Ready to Use]
```

### Step 1: Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

### Step 2: Install Java 21

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install openjdk-21-jdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
```

**macOS:**
```bash
brew install openjdk@21
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

**Windows:**
Download and install OpenJDK 21 from [Adoptium](https://adoptium.net/)

### Step 3: Install MongoDB

**Docker (Recommended):**
```bash
docker run --name openframe-mongo -d \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=openframe \
  -e MONGO_INITDB_ROOT_PASSWORD=yourpassword \
  mongo:7.0
```

**Ubuntu/Debian:**
```bash
sudo apt install mongodb-community
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 4: Build OpenFrame

```bash
# Build all modules
mvn clean install -DskipTests

# Or build specific modules only
mvn clean install -pl openframe-core,openframe-api-service-core -DskipTests
```

### Step 5: Basic Configuration

Create `application.yml` in your config directory:

```yaml
# Basic OpenFrame Configuration
server:
  port: 8080

spring:
  data:
    mongodb:
      uri: mongodb://openframe:yourpassword@localhost:27017/openframe
      
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8080/auth/realms/openframe

# OpenFrame specific settings
openframe:
  security:
    jwt:
      secret: your-jwt-secret-key-here
  features:
    device-management: true
    organization-management: true
    user-management: true
```

## First Steps

### 1. Start the API Service

```bash
# Navigate to API service module
cd openframe-api-service-core

# Start the service
mvn spring-boot:run
```

### 2. Verify Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "UP",
  "components": {
    "mongo": {"status": "UP"},
    "diskSpace": {"status": "UP"}
  }
}
```

### 3. Create Your First Organization

```bash
curl -X POST http://localhost:8080/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "country": "US"
    },
    "contactInformation": {
      "email": "contact@mycompany.com",
      "phone": "+1-555-0123"
    }
  }'
```

### 4. Register a Device

```bash
curl -X PATCH http://localhost:8080/devices/{machineId} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE"
  }'
```

## Quick Feature Overview

<details>
<summary><strong>Device Management</strong></summary>

- **Device Registration**: Automatically register devices when they come online
- **Status Monitoring**: Track device health and connectivity
- **Remote Management**: Execute commands and deploy configurations
- **Agent Installation**: Install and manage OpenFrame agents on devices

</details>

<details>
<summary><strong>Organization Management</strong></summary>

- **Multi-tenant Architecture**: Isolate data and access per organization
- **User Roles**: Assign different permission levels to users
- **API Key Management**: Generate and manage API access credentials
- **Audit Logging**: Track all organizational activities

</details>

<details>
<summary><strong>Security Features</strong></summary>

- **OAuth2/JWT Authentication**: Industry-standard authentication
- **Role-based Access Control**: Fine-grained permission management
- **SSO Integration**: Connect with existing identity providers
- **API Security**: Secure all endpoints with proper authorization

</details>

## Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **MongoDB Connection Failed** | Service won't start, connection errors | Check MongoDB is running and credentials are correct |
| **Java Version Error** | Build failures, ClassNotFound exceptions | Ensure Java 21+ is installed and JAVA_HOME is set |
| **Port Already in Use** | Service startup fails with port binding error | Change server.port in application.yml or stop conflicting service |
| **Memory Issues** | OutOfMemoryError, slow performance | Increase JVM heap size: `export JAVA_OPTS="-Xmx4g"` |
| **Build Failures** | Maven compilation errors | Clean and rebuild: `mvn clean install -U` |

## Next Steps

> **Congratulations!** You've successfully installed OpenFrame OSS.

**What's Next?**
- 📖 Read the [Common Use Cases Guide](common-use-cases.md) for practical examples
- 🔧 Configure additional features like Kafka messaging
- 🛡️ Set up proper security and SSL certificates
- 📊 Explore the monitoring and logging capabilities
- 🚀 Deploy to production using Docker containers

**Need Help?**
- 📚 Check the [Developer Documentation](../dev/getting-started-dev.md)
- 🐛 Report issues on [GitHub](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- 💬 Join our community discussions

---

*This guide covers the basic installation. For production deployments, refer to our deployment and security guides.*