# Prerequisites

Before getting started with OpenFrame OSS Library, ensure your development environment meets the following requirements.

## Required Software

| Software | Version | Purpose | Download |
|----------|---------|---------|-----------|
| **Java** | 21+ | Runtime environment | [OpenJDK](https://adoptium.net/) or [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) |
| **Maven** | 3.6+ | Build tool and dependency management | [Apache Maven](https://maven.apache.org/download.cgi) |
| **MongoDB** | 7.0+ | Primary database for entities and documents | [MongoDB Community](https://www.mongodb.com/try/download/community) |
| **Git** | Latest | Version control | [Git Downloads](https://git-scm.com/downloads) |

## Optional Dependencies

| Software | Version | Purpose | Download |
|----------|---------|---------|-----------|
| **Redis** | 7.0+ | Caching and session storage | [Redis Downloads](https://redis.io/downloads) |
| **Apache Kafka** | 3.0+ | Event streaming (for advanced features) | [Apache Kafka](https://kafka.apache.org/downloads) |
| **Docker** | Latest | Containerized development | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

## Development Tools

### Recommended IDEs

- **[IntelliJ IDEA](https://www.jetbrains.com/idea/)** - Excellent Spring Boot support and Java development
- **[Eclipse](https://www.eclipse.org/ide/)** - Free IDE with Spring Tools Suite
- **[Visual Studio Code](https://code.visualstudio.com/)** - Lightweight with Java extensions

### IDE Extensions

For **IntelliJ IDEA**:
- Spring Boot Plugin
- MongoDB Plugin
- Docker Plugin

For **VS Code**:
- Extension Pack for Java
- Spring Boot Extension Pack
- MongoDB for VS Code

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB available
- **Storage**: 2 GB free space
- **Network**: Internet connection for dependencies

### Recommended Requirements

- **CPU**: 4+ cores
- **RAM**: 8 GB available
- **Storage**: 10 GB free space (includes databases)
- **Network**: High-speed internet for development

## Account Requirements

### Required Accounts

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **GitHub** | Source code access and version control | [GitHub Sign Up](https://github.com/join) |

### Optional Accounts

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **OpenMSP Slack** | Community support and discussions | [Join OpenMSP](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) |
| **Docker Hub** | Container images (if using Docker) | [Docker Hub](https://hub.docker.com/signup) |

## Environment Variables

Set up these environment variables for development:

### Required Variables

```bash
# Java Development
export JAVA_HOME="/path/to/java21"
export PATH="$JAVA_HOME/bin:$PATH"

# Maven
export MAVEN_HOME="/path/to/maven"
export PATH="$MAVEN_HOME/bin:$PATH"
```

### Database Configuration

```bash
# MongoDB Connection
export MONGODB_URI="mongodb://localhost:27017/openframe_dev"
export MONGODB_DATABASE="openframe_dev"

# Redis (Optional)
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
```

### Application Security

```bash
# JWT Secret (for development)
export JWT_SECRET="your-development-jwt-secret-minimum-32-characters"

# OAuth Configuration (if needed)
export OAUTH_CLIENT_ID="your-oauth-client-id"
export OAUTH_CLIENT_SECRET="your-oauth-client-secret"
```

## Verification Commands

Run these commands to verify your setup:

### Java Installation

```bash
java -version
```

Expected output:
```text
openjdk version "21.0.x" 2024-xx-xx
OpenJDK Runtime Environment (build 21.0.x+x)
OpenJDK 64-Bit Server VM (build 21.0.x+x, mixed mode, sharing)
```

### Maven Installation

```bash
mvn -version
```

Expected output:
```text
Apache Maven 3.x.x
Maven home: /path/to/maven
Java version: 21.0.x
```

### MongoDB Connection

```bash
# Start MongoDB service
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Test connection
mongosh --eval "db.adminCommand('ismaster')"
```

### Git Configuration

```bash
git --version
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Docker Setup (Optional)

If you prefer using Docker for databases:

### MongoDB with Docker

```bash
# Run MongoDB container
docker run -d \
  --name openframe-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=openframe_dev \
  mongo:7.0
```

### Redis with Docker

```bash
# Run Redis container  
docker run -d \
  --name openframe-redis \
  -p 6379:6379 \
  redis:7.0
```

### Docker Compose

Create `docker-compose.yml` for complete setup:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: openframe-mongo
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: openframe_dev
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7.0
    container_name: openframe-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

Start with:
```bash
docker-compose up -d
```

## Network Configuration

### Firewall Rules

Ensure these ports are accessible:

| Port | Service | Purpose |
|------|---------|---------|
| 27017 | MongoDB | Database connections |
| 6379 | Redis | Cache connections (optional) |
| 8080 | Spring Boot | Default application port |
| 3000 | Frontend | Development server (if applicable) |

### Proxy Settings

If behind a corporate proxy, configure Maven:

```xml
<!-- ~/.m2/settings.xml -->
<settings>
  <proxies>
    <proxy>
      <id>proxy</id>
      <active>true</active>
      <protocol>http</protocol>
      <host>proxy.company.com</host>
      <port>8080</port>
    </proxy>
  </proxies>
</settings>
```

## Troubleshooting

### Common Issues

**MongoDB Connection Failed**
```bash
# Check if MongoDB is running
sudo systemctl status mongod
# Or check processes
ps aux | grep mongod
```

**Java Version Conflicts**
```bash
# List all Java versions (macOS)
/usr/libexec/java_home -V

# Switch Java version
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
```

**Maven Permission Issues**
```bash
# Fix Maven permissions
sudo chown -R $USER:$GROUP ~/.m2
```

**Port Already in Use**
```bash
# Find process using port 8080
lsof -i :8080
# Kill process if needed
kill -9 PID
```

## Next Steps

Once your environment is set up and verified:

1. Continue to [Quick Start](./quick-start.md) to create your first OpenFrame application
2. Or proceed to [First Steps](./first-steps.md) for a guided exploration of key features

## Need Help?

- 💬 **Community Support**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 📚 **Documentation**: Check our [Development Guide](../development/README.md)
- 🐛 **Issues**: Report problems through our community channels

Your environment is ready! Let's start building with OpenFrame OSS Library.