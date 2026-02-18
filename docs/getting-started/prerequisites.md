# Prerequisites

Before diving into OpenFrame OSS Lib development, ensure your system meets the following requirements and has the necessary tools installed.

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Operating System** | Linux, macOS, or Windows 10+ | Linux or macOS |
| **Memory (RAM)** | 8 GB | 16 GB or more |
| **Storage** | 10 GB free space | 50 GB SSD |
| **CPU** | 4 cores | 8 cores or more |

## Required Software

### Java Development Kit (JDK)

OpenFrame OSS Lib requires **Java 21** as specified in the parent POM.

```bash
# Verify Java version
java -version

# Should output something like:
# openjdk version "21.0.x" ...
```

**Installation Options:**

| Platform | Installation Method |
|----------|-------------------|
| **Linux** | `apt install openjdk-21-jdk` (Ubuntu) or `yum install java-21-openjdk-devel` (RHEL) |
| **macOS** | `brew install openjdk@21` |
| **Windows** | Download from [Eclipse Temurin](https://adoptium.net/) or [Oracle JDK](https://www.oracle.com/java/technologies/javase/jdk21-archive-downloads.html) |

### Apache Maven

The project uses **Maven 3.8+** for build management.

```bash
# Verify Maven version
mvn -version

# Should output Maven 3.8.x or higher
```

**Installation:**

| Platform | Installation Method |
|----------|-------------------|
| **Linux** | `apt install maven` (Ubuntu) or `yum install maven` (RHEL) |
| **macOS** | `brew install maven` |
| **Windows** | Download from [Apache Maven](https://maven.apache.org/download.cgi) |

### Git

Required for cloning the repository and version control.

```bash
# Verify Git installation
git --version
```

**Installation:**

| Platform | Installation Method |
|----------|-------------------|
| **Linux** | `apt install git` (Ubuntu) or `yum install git` (RHEL) |
| **macOS** | `brew install git` or Xcode Command Line Tools |
| **Windows** | [Git for Windows](https://gitforwindows.org/) |

## Development Dependencies

### Database Systems

While not required for basic library development, you'll need these for full integration testing:

#### MongoDB (Required for Data Layer Testing)

```bash
# Verify MongoDB is running
mongo --version
# or for newer versions
mongosh --version
```

**Installation Options:**
- **Docker**: `docker run -d -p 27017:27017 --name mongodb mongo:7`
- **Local**: Follow [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
- **Cloud**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

#### Redis (Required for Caching Layer)

```bash
# Verify Redis is running
redis-cli ping
# Should return: PONG
```

**Installation Options:**
- **Docker**: `docker run -d -p 6379:6379 --name redis redis:7-alpine`
- **Local**: Follow [Redis Installation Guide](https://redis.io/download)

#### Apache Kafka (Required for Event Processing)

For stream processing testing, you'll need Kafka:

```bash
# Verify Kafka is running (if installed)
kafka-topics.sh --version
```

**Installation Options:**
- **Docker Compose**: Use [Confluent Platform](https://docs.confluent.io/platform/current/quickstart/ce-docker-quickstart.html)
- **Local**: Follow [Apache Kafka Quickstart](https://kafka.apache.org/quickstart)

## Optional Dependencies

### IDE Recommendations

| IDE | Plugins/Extensions |
|-----|-------------------|
| **IntelliJ IDEA** | Lombok Plugin, Spring Boot Plugin |
| **VS Code** | Extension Pack for Java, Spring Boot Extension Pack |
| **Eclipse** | Spring Tool Suite, Lombok Plugin |

### Docker & Docker Compose

For containerized development and testing:

```bash
# Verify Docker installation
docker --version
docker-compose --version
```

**Installation:**
- **Linux**: Follow [Docker Engine Installation](https://docs.docker.com/engine/install/)
- **macOS/Windows**: [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Node.js & npm (For Frontend Components)

Some development tools require Node.js:

```bash
# Verify Node.js version
node --version
npm --version
```

**Recommended Version**: Node.js 18+ LTS

## Environment Variables

Set these environment variables for development:

### Required

```bash
# Database connections
export MONGODB_URI="mongodb://localhost:27017/openframe-dev"
export REDIS_URL="redis://localhost:6379"

# Security
export JWT_SECRET_KEY="your-jwt-secret-key-here"
export ENCRYPTION_SECRET_KEY="your-encryption-secret-here"

# Kafka (if using event processing)
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
```

### Optional

```bash
# External service integrations
export FLEET_MDM_API_URL="https://your-fleet-instance.com"
export TACTICAL_RMM_API_URL="https://your-tactical-instance.com"

# Email notifications (if testing notification features)
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USERNAME="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
```

## Network Requirements

### Ports

Ensure these ports are available for local development:

| Port | Service | Purpose |
|------|---------|---------|
| **8080** | API Service | Main application server |
| **8081** | Gateway Service | API Gateway |
| **8082** | Authorization Service | OAuth2/OIDC server |
| **27017** | MongoDB | Database |
| **6379** | Redis | Cache |
| **9092** | Kafka | Message streaming |
| **2181** | Zookeeper | Kafka coordination |

### Internet Access

Required for:
- Maven dependency downloads
- Docker image pulls
- External API integrations (optional)

## Verification Commands

Run these commands to verify your environment is ready:

### Java & Maven
```bash
# Check Java version
java -version

# Check Maven version
mvn -version

# Test Maven compilation
mvn clean compile
```

### Database Connectivity
```bash
# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Test Redis connection
redis-cli ping
```

### Build System
```bash
# Clone the repository (if not done already)
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Run tests to verify environment
mvn clean test -Dtest=*Test
```

## Troubleshooting

### Common Issues

#### Java Version Mismatch
```bash
# If multiple Java versions are installed, set JAVA_HOME explicitly
export JAVA_HOME=/path/to/java-21
export PATH=$JAVA_HOME/bin:$PATH
```

#### MongoDB Connection Issues
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB if not running
sudo systemctl start mongod
```

#### Maven Dependency Issues
```bash
# Clear Maven cache and reinstall dependencies
rm -rf ~/.m2/repository
mvn clean install -U
```

#### Port Conflicts
```bash
# Find what's using a port
lsof -i :8080

# Kill process using port (replace PID)
kill -9 <PID>
```

## Getting Help

If you encounter issues during setup:

1. **Join the Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Check Documentation**: Review the [development setup guide](../development/setup/local-development.md)
3. **Verify Dependencies**: Ensure all required software versions match the specifications above

---

**Environment Ready?** Continue with the [Quick Start Guide](quick-start.md) to get OpenFrame OSS Lib running locally.