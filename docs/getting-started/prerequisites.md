# Prerequisites

Before you begin working with OpenFrame OSS Libraries, ensure your development environment meets the following requirements. This guide covers all the software, tools, and system requirements needed for successful development and deployment.

## System Requirements

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 8 GB | 16+ GB |
| **Storage** | 20 GB free | 50+ GB SSD |
| **Network** | Stable internet | High-speed connection |

### Operating Systems

OpenFrame OSS Libraries supports development on:

- ✅ **Linux** (Ubuntu 20.04+, CentOS 8+, RHEL 8+)
- ✅ **macOS** (10.15+)
- ✅ **Windows** (10/11 with WSL2 recommended)

> **Note**: For Windows users, we recommend using WSL2 (Windows Subsystem for Linux) for the best development experience.

## Core Development Tools

### Java Development Kit (JDK)

**Required Version**: Java 21+

The project is built with Java 21 and uses modern language features. Earlier versions are not supported.

#### Installation Options:

**Option 1: Oracle JDK**
```bash
# Download from Oracle website
# https://www.oracle.com/java/technologies/downloads/
```

**Option 2: OpenJDK (Recommended)**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# macOS (using Homebrew)
brew install openjdk@21

# Windows (using Chocolatey)
choco install openjdk21
```

**Verification:**
```bash
java -version
# Should show: openjdk version "21.x.x"
```

### Maven Build Tool

**Required Version**: Maven 3.6+

Maven is used for dependency management and building the project.

#### Installation:

```bash
# Ubuntu/Debian
sudo apt install maven

# macOS (using Homebrew)
brew install maven

# Windows (using Chocolatey)
choco install maven
```

**Verification:**
```bash
mvn -version
# Should show Maven 3.6+ and Java 21
```

## Database Systems

OpenFrame OSS Libraries requires multiple database systems for different use cases.

### MongoDB

**Required Version**: 5.0+

MongoDB serves as the primary operational database for user data, organizations, configurations, and real-time state.

#### Installation:

**Docker (Recommended for Development)**
```bash
docker run --name openframe-mongo \
  -p 27017:27017 \
  -d mongo:7-jammy
```

**Native Installation**
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# macOS
brew tap mongodb/brew
brew install mongodb-community

# Windows
# Download from: https://www.mongodb.com/try/download/community
```

### Redis

**Required Version**: 6.0+

Redis provides caching, session storage, and distributed locking capabilities.

#### Installation:

**Docker (Recommended)**
```bash
docker run --name openframe-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

**Native Installation**
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis

# Windows
# Use Docker or WSL2
```

### Apache Kafka

**Required Version**: 2.8+

Kafka handles event streaming and messaging between services.

#### Installation:

**Docker Compose (Recommended)**
```yaml
# Create docker-compose.kafka.yml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

```bash
docker-compose -f docker-compose.kafka.yml up -d
```

## Optional Dependencies

### Apache Cassandra

**Required Version**: 4.0+

Used for audit log storage and time-series data.

**Docker Installation:**
```bash
docker run --name openframe-cassandra \
  -p 9042:9042 \
  -d cassandra:4.1
```

### Apache Pinot

**Required Version**: 0.12+

Provides real-time analytics and OLAP capabilities.

**Docker Installation:**
```bash
docker run --name openframe-pinot \
  -p 9000:9000 \
  -d apachepinot/pinot:latest-jdk21 QuickStart -type batch
```

### NATS Server

**Required Version**: 2.9+

Handles real-time agent communication and streaming.

**Docker Installation:**
```bash
docker run --name openframe-nats \
  -p 4222:4222 \
  -p 8222:8222 \
  -d nats:latest -js
```

## Development Environment Setup

### Environment Variables

Create a `.env` file in your development environment with the following variables:

```bash
# Database Connections
MONGODB_URI=mongodb://localhost:27017/openframe
REDIS_URL=redis://localhost:6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Optional Analytics
CASSANDRA_CONTACT_POINTS=localhost:9042
PINOT_BROKER_URL=http://localhost:8099

# Security Configuration
JWT_SECRET=your-development-jwt-secret
OAUTH_ENCRYPTION_KEY=your-32-char-encryption-key

# External Services (Development)
NATS_URL=nats://localhost:4222
```

### IDE Configuration

**Recommended IDEs:**
- ✅ IntelliJ IDEA Ultimate (with Spring Boot plugin)
- ✅ Eclipse with Spring Tools
- ✅ Visual Studio Code with Extension Pack for Java

**Required IDE Plugins:**
- Lombok (for code generation)
- Spring Boot Tools
- Maven integration

## Verification Commands

After installing all prerequisites, verify your setup:

### Check Java and Maven
```bash
java -version
mvn -version
```

### Test Database Connections
```bash
# MongoDB
mongosh --eval "db.adminCommand('ping')"

# Redis
redis-cli ping

# Kafka (if running)
kafka-console-producer.sh --bootstrap-server localhost:9092 --topic test
```

### Environment Verification Script
```bash
#!/bin/bash
echo "=== OpenFrame OSS Lib Environment Check ==="

# Java
if java -version 2>&1 | grep -q "21"; then
    echo "✅ Java 21+ detected"
else
    echo "❌ Java 21+ not found"
fi

# Maven
if mvn -version &> /dev/null; then
    echo "✅ Maven available"
else
    echo "❌ Maven not found"
fi

# MongoDB
if mongosh --quiet --eval "quit()" 2>/dev/null; then
    echo "✅ MongoDB connection successful"
else
    echo "❌ MongoDB connection failed"
fi

# Redis
if redis-cli ping &> /dev/null; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
fi
```

## Network and Security Requirements

### Firewall Ports

Ensure the following ports are accessible:

| Service | Port | Purpose |
|---------|------|---------|
| MongoDB | 27017 | Database access |
| Redis | 6379 | Cache access |
| Kafka | 9092 | Message broker |
| Cassandra | 9042 | Analytics database |
| Pinot | 8099, 9000 | Analytics queries |
| NATS | 4222, 8222 | Agent communication |

### Memory Settings

For optimal performance, configure JVM memory settings:

```bash
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"
```

## Next Steps

Once your environment is ready:

1. **[Quick Start Guide](quick-start.md)** - Build and run OpenFrame OSS Lib in 5 minutes
2. **[Development Setup](../development/setup/local-development.md)** - Detailed development environment configuration

## Troubleshooting

### Common Issues

**Java Version Mismatch**
```bash
# Check JAVA_HOME
echo $JAVA_HOME
# Update if needed
export JAVA_HOME=/path/to/java21
```

**Maven Build Failures**
```bash
# Clear cache and retry
mvn clean install -U
```

**Database Connection Issues**
- Verify services are running: `docker ps`
- Check network connectivity: `telnet localhost 27017`
- Review firewall settings

For additional help, join our [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA).