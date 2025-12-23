# Prerequisites

Before you begin working with OpenFrame OSS Library, ensure your development environment meets the following requirements. This guide covers everything you need to get started with development, testing, or integration.

## System Requirements

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 8 GB | 16 GB or more |
| **CPU** | 4 cores | 8 cores or more |
| **Storage** | 10 GB free space | 50 GB free space |
| **Network** | Stable internet connection | High-speed broadband |

### Operating System Support

OpenFrame OSS Library supports development on:

- ✅ **Linux** (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- ✅ **macOS** (macOS 11+ Big Sur)
- ✅ **Windows** (Windows 10/11 with WSL2 recommended)

## Required Software

### Java Development Kit (JDK)

OpenFrame requires **Java 17** or later.

| Platform | Installation Command |
|----------|---------------------|
| **Ubuntu/Debian** | `sudo apt update && sudo apt install openjdk-17-jdk` |
| **macOS** | `brew install openjdk@17` |
| **Windows** | Download from [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) |

**Verify Installation:**

```bash
java -version
javac -version
```

Expected output:
```text
openjdk version "17.0.x" 2023-xx-xx
OpenJDK Runtime Environment (build 17.0.x+x-Ubuntu-x)
OpenJDK 64-Bit Server VM (build 17.0.x+x-Ubuntu-x, mixed mode, sharing)
```

### MongoDB

OpenFrame uses MongoDB as its primary database.

| Platform | Installation |
|----------|--------------|
| **Ubuntu/Debian** | `wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc \| sudo apt-key add -` <br/> `echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" \| sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list` <br/> `sudo apt update && sudo apt install -y mongodb-org` |
| **macOS** | `brew tap mongodb/brew && brew install mongodb-community` |
| **Windows** | Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community) |
| **Docker** | `docker run --name mongodb -p 27017:27017 -d mongo:7.0` |

**Start MongoDB:**

```bash
# Linux/macOS
sudo systemctl start mongod
sudo systemctl enable mongod

# macOS with Homebrew
brew services start mongodb-community

# Docker
docker start mongodb
```

**Verify MongoDB Connection:**

```bash
mongosh --eval "db.adminCommand('ping')"
```

### Redis (Optional but Recommended)

Redis is used for caching and session management.

| Platform | Installation |
|----------|--------------|
| **Ubuntu/Debian** | `sudo apt update && sudo apt install redis-server` |
| **macOS** | `brew install redis` |
| **Windows** | Use WSL2 or download from [Redis website](https://redis.io/download) |
| **Docker** | `docker run --name redis -p 6379:6379 -d redis:7-alpine` |

**Start Redis:**

```bash
# Linux
sudo systemctl start redis-server

# macOS
brew services start redis

# Docker
docker start redis
```

**Verify Redis:**

```bash
redis-cli ping
```

Expected response: `PONG`

### Apache Kafka (For Event Processing)

Required for event streaming and processing.

| Platform | Installation |
|----------|--------------|
| **Any** | Download from [Apache Kafka](https://kafka.apache.org/downloads) |
| **Docker** | `docker run --name kafka -p 9092:9092 -d confluentinc/cp-kafka:latest` |

### Git

Version control system for source code management.

```bash
# Ubuntu/Debian
sudo apt install git

# macOS
brew install git

# Windows
# Download from https://git-scm.com/download/win
```

**Verify Git:**

```bash
git --version
```

## Development Tools

### IDE Recommendations

| IDE | Best For | Download |
|-----|----------|----------|
| **IntelliJ IDEA** | Java development (recommended) | [JetBrains](https://www.jetbrains.com/idea/) |
| **Eclipse** | Free Java IDE | [Eclipse Foundation](https://www.eclipse.org/downloads/) |
| **Visual Studio Code** | Lightweight, multi-language | [Microsoft](https://code.visualstudio.com/) |

### Build Tools

OpenFrame uses **Gradle** as its build system:

```bash
# Install Gradle
# Ubuntu/Debian
sudo apt install gradle

# macOS
brew install gradle

# Windows (with Chocolatey)
choco install gradle

# Verify installation
gradle --version
```

### Essential IDE Plugins

For **IntelliJ IDEA**:
- Lombok Plugin
- Spring Boot Plugin  
- Database Tools and SQL

For **Visual Studio Code**:
- Extension Pack for Java
- Spring Boot Extension Pack
- MongoDB for VS Code

## Network and Access Requirements

### Port Requirements

Ensure these ports are available:

| Service | Port | Purpose |
|---------|------|---------|
| **MongoDB** | 27017 | Database connection |
| **Redis** | 6379 | Cache and sessions |
| **Kafka** | 9092 | Event streaming |
| **Application** | 8080 | Default Spring Boot port |
| **Gateway** | 8081 | API Gateway |
| **Auth Service** | 8082 | Authorization service |

### Internet Access

Required for:
- Maven/Gradle dependencies
- MongoDB Atlas (if using cloud)
- External API integrations
- Documentation and updates

## Environment Variables

Set these environment variables in your development environment:

```bash
# Add to your ~/.bashrc, ~/.zshrc, or equivalent

# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# MongoDB
export MONGODB_URI=mongodb://localhost:27017/openframe

# Redis
export REDIS_URL=redis://localhost:6379

# Application
export SPRING_PROFILES_ACTIVE=development
```

## Verification Checklist

Run these commands to verify your setup:

### ✅ Java and Build Tools

```bash
java -version        # Should show Java 17+
javac -version       # Should show Java 17+  
gradle --version     # Should show Gradle info
```

### ✅ Database Services

```bash
# MongoDB
mongosh --eval "db.adminCommand('ping')"

# Redis  
redis-cli ping

# Check MongoDB is running
sudo systemctl status mongod

# Check Redis is running  
sudo systemctl status redis
```

### ✅ Network Connectivity

```bash
# Test port availability
telnet localhost 27017  # MongoDB
telnet localhost 6379   # Redis
```

### ✅ Environment Variables

```bash
echo $JAVA_HOME
echo $MONGODB_URI
echo $REDIS_URL
```

## Common Issues and Solutions

### Issue: Java Version Conflicts

```bash
# List all Java versions
update-alternatives --list java

# Set default Java version
sudo update-alternatives --config java
```

### Issue: MongoDB Connection Refused

```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod
```

### Issue: Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill process if needed
kill -9 <PID>
```

## Optional Tools

### Database Management

| Tool | Purpose | Platform |
|------|---------|----------|
| **MongoDB Compass** | MongoDB GUI | [Download](https://www.mongodb.com/try/download/compass) |
| **Redis Desktop Manager** | Redis GUI | Cross-platform |
| **DBeaver** | Universal database tool | Cross-platform |

### API Testing

| Tool | Purpose | 
|------|---------|
| **Postman** | API testing and documentation |
| **Insomnia** | REST API client |
| **curl** | Command-line HTTP client |

### Container Tools (Optional)

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Next Steps

Once you've completed the prerequisites setup:

1. ✅ **Verify your installation** using the checklist above
2. 🚀 **Continue to [Quick Start Guide](quick-start.md)** to build and run your first OpenFrame application
3. 🔧 **Or jump to [Development Setup](../development/setup/environment.md)** for a full development environment

## Need Help?

If you encounter any issues during setup:

- 📖 Check our [troubleshooting section](#common-issues-and-solutions)
- 💬 Ask questions in GitHub Discussions
- 🐛 Report setup issues on GitHub Issues
- 📧 Contact the OpenFrame team for enterprise support

Your development environment is the foundation for everything you'll build with OpenFrame. Take time to set it up correctly!