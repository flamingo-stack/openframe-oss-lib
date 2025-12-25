# Prerequisites

This guide covers everything you need to set up your development environment for working with the OpenFrame OSS Library.

## System Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| **Operating System** | Linux, macOS, Windows | Linux/macOS | WSL2 recommended for Windows |
| **RAM** | 8 GB | 16 GB+ | For running local services |
| **Storage** | 10 GB free | 20 GB+ | For databases and dependencies |
| **CPU** | 2 cores | 4+ cores | For building and testing |

## Required Software

### 1. Java Development Kit (JDK) 21

OpenFrame requires Java 21 or later.

#### Installation

**Linux/macOS (using SDKMAN - Recommended):**
```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 21
sdk install java 21.0.1-tem
sdk use java 21.0.1-tem
```

**Manual Installation:**
- Download from [Eclipse Temurin](https://adoptium.net/temurin/releases/)
- Or use your system package manager

#### Verification
```bash
java -version
# Should output: openjdk version "21.0.1" or similar

javac -version
# Should output: javac 21.0.1 or similar
```

### 2. Apache Maven 3.6+

Maven is used for dependency management and building.

#### Installation

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install maven

# CentOS/RHEL
sudo yum install maven
```

**macOS:**
```bash
# Using Homebrew
brew install maven
```

**Windows:**
- Download from [Apache Maven](https://maven.apache.org/download.cgi)
- Add to `PATH` environment variable

#### Verification
```bash
mvn -version
# Should show Maven 3.6+ and Java 21
```

### 3. Git

Required for cloning repositories and version control.

```bash
# Linux
sudo apt install git  # Ubuntu/Debian
sudo yum install git  # CentOS/RHEL

# macOS
brew install git

# Windows
# Download from https://git-scm.com/
```

#### Verification
```bash
git --version
# Should output: git version 2.30+ or similar
```

## Database Requirements

### 1. MongoDB

OpenFrame uses MongoDB as its primary database.

#### Installation

**Using Docker (Recommended for Development):**
```bash
# Start MongoDB container
docker run -d \
  --name openframe-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  -v mongodb_data:/data/db \
  mongo:7
```

**Native Installation:**

**Linux:**
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

#### Verification
```bash
# If using Docker
docker exec openframe-mongodb mongosh --eval "db.runCommand('connectionStatus')"

# If using native installation
mongosh --eval "db.runCommand('connectionStatus')"
```

### 2. Redis (Optional but Recommended)

Redis is used for caching and session management.

#### Installation

**Using Docker:**
```bash
docker run -d \
  --name openframe-redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Native Installation:**
```bash
# Linux
sudo apt install redis-server  # Ubuntu/Debian
sudo yum install redis         # CentOS/RHEL

# macOS
brew install redis
```

#### Verification
```bash
# If using Docker
docker exec openframe-redis redis-cli ping
# Should return: PONG

# If using native installation
redis-cli ping
# Should return: PONG
```

## Optional Components

### Apache Kafka (For Event Streaming)

Required for advanced event processing features.

**Using Docker:**
```bash
# Create docker-compose.yml for Kafka
cat > docker-compose.kafka.yml << 'EOF'
version: '3'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
EOF

# Start Kafka
docker-compose -f docker-compose.kafka.yml up -d
```

## Development Environment Setup

### Environment Variables

Create a `.env` file for local development:

```bash
# Database Configuration
SPRING_DATA_MONGODB_URI=mongodb://admin:password123@localhost:27017/openframe?authSource=admin
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379

# Security Configuration
JWT_SECRET=your-256-bit-secret-key-here-change-this-in-production
JWT_EXPIRATION=86400

# Application Configuration
SPRING_PROFILES_ACTIVE=local
LOGGING_LEVEL_COM_OPENFRAME=DEBUG

# Optional: Kafka Configuration
SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### IDE Recommendations

#### IntelliJ IDEA (Recommended)

**Required Plugins:**
- Lombok
- Spring Boot
- MongoDB Plugin

**Settings:**
1. Enable annotation processing: `Settings` → `Build` → `Compiler` → `Annotation Processors` → ✅ Enable
2. Set JDK to 21: `File` → `Project Structure` → `Project` → `Project SDK`

#### VS Code

**Required Extensions:**
- Extension Pack for Java
- Spring Boot Extension Pack
- MongoDB for VS Code

#### Eclipse

**Required Plugins:**
- Spring Tools 4
- Lombok Plugin

### System Configuration

#### Increase File Limits (Linux/macOS)

```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'ulimit -n 8192' >> ~/.bashrc
source ~/.bashrc
```

#### Configure Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
```

## Verification Checklist

Run these commands to verify your environment is ready:

```bash
# Check Java
java -version | grep "21\."
echo "✅ Java 21: $?"

# Check Maven
mvn -version | grep "Maven"
echo "✅ Maven: $?"

# Check Git
git --version
echo "✅ Git: $?"

# Check MongoDB connection
mongosh --eval "db.runCommand('ismaster')" --quiet
echo "✅ MongoDB: $?"

# Check Redis connection (if installed)
redis-cli ping 2>/dev/null || echo "⚠️ Redis: Optional, not required"
```

## Common Issues & Solutions

<details>
<summary>Java Version Issues</summary>

**Problem:** Wrong Java version or `JAVA_HOME` not set

**Solution:**
```bash
# Find Java installation
sudo find /usr -name "java" -type f 2>/dev/null

# Set JAVA_HOME (add to ~/.bashrc)
export JAVA_HOME=/path/to/java21
export PATH="$JAVA_HOME/bin:$PATH"
```
</details>

<details>
<summary>MongoDB Connection Issues</summary>

**Problem:** Cannot connect to MongoDB

**Solution:**
```bash
# Check if MongoDB is running
docker ps | grep mongo  # For Docker
sudo systemctl status mongod  # For native installation

# Test connection with authentication
mongosh "mongodb://admin:password123@localhost:27017/?authSource=admin"
```
</details>

<details>
<summary>Maven Download Issues</summary>

**Problem:** Slow dependency downloads

**Solution:**
```bash
# Use a faster Maven mirror - add to ~/.m2/settings.xml
mkdir -p ~/.m2
cat > ~/.m2/settings.xml << 'EOF'
<settings>
  <mirrors>
    <mirror>
      <id>central-mirror</id>
      <name>Central Mirror</name>
      <url>https://repo1.maven.org/maven2</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
EOF
```
</details>

## Next Steps

✅ **Environment Ready?** Proceed to the [Quick Start Guide](quick-start.md) to build and run your first OpenFrame service.

> 💡 **Tip**: Keep your development environment clean by using Docker containers for databases. This makes it easy to reset state during development and testing.

---

**Need Help?** 
- Check our [troubleshooting section](first-steps.md#troubleshooting)
- Visit [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- Join our community discussions