# Getting Started with OpenFrame

Welcome to OpenFrame, a comprehensive platform for device and organization management. This guide will help you get started quickly and easily.

## Prerequisites

Before installing OpenFrame, ensure you have the following prerequisites:

| Requirement | Version | Purpose | Download Link |
|------------|---------|---------|---------------|
| Java JDK | 21+ | Runtime environment | [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) or [OpenJDK](https://openjdk.org/) |
| Maven | 3.8+ | Build tool | [Apache Maven](https://maven.apache.org/download.cgi) |
| MongoDB | 4.4+ | Database | [MongoDB Community](https://www.mongodb.com/try/download/community) |
| Apache Kafka | 2.8+ | Message streaming | [Apache Kafka](https://kafka.apache.org/downloads) |
| NATS | 2.9+ | Message broker | [NATS Server](https://nats.io/download/) |

## Installation Process

```mermaid
flowchart TD
    A[Download OpenFrame] --> B[Install Prerequisites]
    B --> C[Configure Database]
    C --> D[Set Environment Variables]
    D --> E[Build Project]
    E --> F[Start Services]
    F --> G[Verify Installation]
    G --> H[Access Web Interface]
```

### Step 1: Download and Setup

1. Clone the OpenFrame repository:
```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

2. Verify Java installation:
```bash
java -version
# Should show Java 21 or higher
```

### Step 2: Database Setup

1. Start MongoDB:
```bash
# On Linux/Mac with systemd
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6.0
```

2. Create the OpenFrame database:
```bash
mongosh
use openframe
db.createUser({
  user: "openframe",
  pwd: "your-secure-password",
  roles: [{ role: "readWrite", db: "openframe" }]
})
```

### Step 3: Message Broker Setup

1. Start NATS server:
```bash
# Download and start NATS
nats-server
```

2. Start Kafka (if using Kafka features):
```bash
# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# Start Kafka
bin/kafka-server-start.sh config/server.properties
```

### Step 4: Configuration

Create an `application.yml` file in your configuration directory:

```yaml
server:
  port: 8080

spring:
  data:
    mongodb:
      uri: mongodb://openframe:your-secure-password@localhost:27017/openframe
  
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8080/auth/realms/openframe

openframe:
  api:
    cors:
      allowed-origins: http://localhost:3000
  security:
    jwt:
      secret: your-jwt-secret-key-here-minimum-256-bits
```

### Step 5: Build and Run

1. Build the project:
```bash
mvn clean install -DskipTests
```

2. Start the API service:
```bash
cd openframe-api-service-core
mvn spring-boot:run
```

3. Start additional services as needed:
```bash
# In separate terminals
cd openframe-management-service-core
mvn spring-boot:run

cd openframe-gateway-service-core
mvn spring-boot:run
```

## First Steps

### Verify Installation

1. Check service health:
```bash
curl http://localhost:8080/health
# Should return: {"status":"UP"}
```

2. Test API connectivity:
```bash
curl http://localhost:8080/api/v1/organizations
# Should return organization data or authentication prompt
```

### Create Your First Organization

Using curl to create an organization:

```bash
curl -X POST http://localhost:8080/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "name": "My First Organization",
    "description": "Getting started with OpenFrame",
    "contactInformation": {
      "email": "admin@myorg.com",
      "phone": "+1-555-0123"
    },
    "address": {
      "street": "123 Business St",
      "city": "Tech City",
      "state": "CA",
      "zipCode": "90210",
      "country": "USA"
    }
  }'
```

### Access the Web Interface

> **Note**: The web interface URL will depend on your frontend deployment. The API runs on port 8080 by default.

1. Open your browser to: `http://localhost:3000` (or your configured frontend URL)
2. Log in with your credentials
3. Navigate to Organizations to see your newly created organization

## Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Port already in use** | `Address already in use: bind` | Change port in `application.yml` or kill existing process |
| **Database connection failed** | `MongoSocketOpenException` | Verify MongoDB is running and credentials are correct |
| **Build failures** | Maven compilation errors | Ensure Java 21+ is installed and `JAVA_HOME` is set |
| **Authentication errors** | 401/403 HTTP responses | Check JWT configuration and API token validity |
| **CORS issues** | Browser console errors | Update `allowed-origins` in configuration |

### Quick Troubleshooting Commands

```bash
# Check running processes
ps aux | grep java

# Verify database connection
mongosh --host localhost:27017 -u openframe -p

# Check application logs
tail -f logs/openframe-api.log

# Validate configuration
mvn validate
```

## Next Steps

Now that OpenFrame is running, you can:

1. **Explore the API**: Check out our [Common Use Cases](common-use-cases.md) guide
2. **Add devices**: Connect your first devices to the platform
3. **Set up monitoring**: Configure alerts and dashboards
4. **Integrate tools**: Connect external management tools via our SDK

## Getting Help

- **Documentation**: Visit our full documentation at `/docs`
- **API Reference**: Access the GraphQL playground at `http://localhost:8080/graphiql`
- **Community**: Join our community forums for support
- **Issues**: Report bugs on our GitHub repository

> **🎉 Congratulations!** You've successfully set up OpenFrame. You're ready to start managing devices and organizations efficiently.