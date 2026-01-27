# Development Environment Setup

Set up your development environment for building applications with OpenFrame OSS Library. This guide covers IDE configuration, development tools, and environment optimization.

## IDE Setup & Configuration

### IntelliJ IDEA (Recommended)

IntelliJ IDEA provides excellent Spring Boot and Java development support.

#### Installation

1. **Download IntelliJ IDEA**
   - [IntelliJ IDEA Community](https://www.jetbrains.com/idea/download/) (Free)
   - [IntelliJ IDEA Ultimate](https://www.jetbrains.com/idea/download/) (Paid, enhanced Spring support)

2. **Install Required Plugins**

   Go to `File > Settings > Plugins` and install:
   
   | Plugin | Purpose |
   |--------|---------|
   | **Spring Boot** | Enhanced Spring Boot support |
   | **MongoDB Plugin** | MongoDB integration and query support |
   | **Docker** | Container management |
   | **SonarLint** | Real-time code quality analysis |
   | **GitToolBox** | Enhanced Git integration |

#### Configuration

**Java SDK Configuration:**
```text
File > Project Structure > Project Settings > Project
- Project SDK: 21 (OpenJDK or Oracle JDK)
- Project language level: 21 - Pattern matching for switch
```

**Maven Configuration:**
```text
File > Settings > Build, Execution, Deployment > Build Tools > Maven
- Maven home path: /path/to/maven
- User settings file: ~/.m2/settings.xml
- Local repository: ~/.m2/repository
- Import Maven projects automatically: ✓
```

**Code Style Configuration:**
```text
File > Settings > Editor > Code Style > Java
- Import Google Java Style Guide
- Line separator: Unix and macOS (\n)
- Right margin: 120 characters
```

### Visual Studio Code

VS Code is a lightweight alternative with excellent Java support.

#### Installation & Extensions

```bash
# Install VS Code extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension redhat.java
code --install-extension pivotal.vscode-spring-boot
code --install-extension mongodb.mongodb-vscode
code --install-extension ms-azuretools.vscode-docker
code --install-extension sonarsource.sonarlint-vscode
```

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "java.configuration.detectJdksAtStart": false,
  "java.jdt.ls.java.home": "/path/to/java-21",
  "java.compile.nullAnalysis.mode": "automatic",
  "spring-boot.ls.problem.application-properties.unknown-property": "warning",
  "mongodb.connectionSaving.hideOptionToChooseWhereToSaveNewConnections": true,
  "files.exclude": {
    "**/target": true,
    "**/.classpath": true,
    "**/.project": true,
    "**/.settings": true
  }
}
```

## Development Tools Installation

### Java Development Kit (JDK)

#### Option 1: Using Package Managers

**macOS (Homebrew):**
```bash
# Install OpenJDK 21
brew install openjdk@21

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
java -version
```

**Ubuntu/Debian:**
```bash
# Install OpenJDK 21
sudo apt update
sudo apt install openjdk-21-jdk

# Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc
```

**Windows (Chocolatey):**
```powershell
# Install OpenJDK 21
choco install openjdk21

# Verify installation
java -version
```

#### Option 2: Manual Installation

1. Download from [Adoptium](https://adoptium.net/) or [Oracle](https://www.oracle.com/java/technologies/downloads/)
2. Extract to preferred location
3. Set `JAVA_HOME` environment variable
4. Add `$JAVA_HOME/bin` to `PATH`

### Maven Build Tool

#### Installation

**macOS:**
```bash
brew install maven
```

**Ubuntu/Debian:**
```bash
sudo apt install maven
```

**Windows:**
```powershell
choco install maven
```

#### Configuration

Create `~/.m2/settings.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">

  <!-- Local repository path -->
  <localRepository>${user.home}/.m2/repository</localRepository>

  <!-- Profile for OpenFrame development -->
  <profiles>
    <profile>
      <id>openframe-dev</id>
      <properties>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
      </properties>
    </profile>
  </profiles>

  <!-- Activate development profile -->
  <activeProfiles>
    <activeProfile>openframe-dev</activeProfile>
  </activeProfiles>

</settings>
```

## Database Development Environment

### MongoDB Setup

#### Option 1: Docker (Recommended)

```bash
# Create docker-compose.yml for development
cat > docker-compose.dev.yml << EOF
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: openframe-mongo-dev
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: openframe_dev
    volumes:
      - mongodb_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    command: mongod --auth

  redis:
    image: redis:7.0-alpine
    container_name: openframe-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  mongodb_data:
  redis_data:
EOF

# Start development databases
docker-compose -f docker-compose.dev.yml up -d
```

#### Option 2: Local Installation

**macOS:**
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB
brew services start mongodb/brew/mongodb-community@7.0
```

**Ubuntu:**
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Database Development Tools

#### MongoDB Compass (GUI)

Download from [MongoDB Compass](https://www.mongodb.com/try/download/compass)

**Connection Settings for Development:**
- Hostname: `localhost`
- Port: `27017`
- Authentication: None (for local development)

#### MongoDB Shell

```bash
# Install mongosh
brew install mongosh  # macOS
sudo apt install mongodb-mongosh  # Ubuntu

# Connect to development database
mongosh "mongodb://localhost:27017/openframe_dev"
```

## Environment Variables

### Development Environment File

Create `.env.development`:

```bash
# Application Environment
SPRING_PROFILES_ACTIVE=development
SERVER_PORT=8080

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/openframe_dev
MONGODB_DATABASE=openframe_dev

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security Configuration
JWT_SECRET=development-jwt-secret-must-be-at-least-32-characters-long
JWT_EXPIRATION=86400
JWT_REFRESH_EXPIRATION=604800

# OAuth Configuration (Optional)
OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Logging Configuration  
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_OPENFRAME=DEBUG

# Development Features
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info,metrics,env
MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always
```

### Load Environment Variables

**IntelliJ IDEA:**
1. Go to `Run > Edit Configurations`
2. Select your application configuration
3. Add environment variables or load from file

**VS Code:**
Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "OpenFrame Application",
      "request": "launch",
      "mainClass": "com.example.openframe.Application",
      "envFile": "${workspaceFolder}/.env.development",
      "args": [],
      "console": "internalConsole"
    }
  ]
}
```

## Code Quality Tools

### SonarQube (Optional)

#### Docker Setup

```bash
# Run SonarQube for code analysis
docker run -d --name sonarqube \
  -p 9000:9000 \
  sonarqube:10.3-community

# Access SonarQube at http://localhost:9000
# Default credentials: admin/admin
```

#### Maven Configuration

Add to your `pom.xml`:

```xml
<properties>
  <sonar.host.url>http://localhost:9000</sonar.host.url>
  <sonar.login>your-sonar-token</sonar.login>
</properties>

<plugins>
  <plugin>
    <groupId>org.sonarsource.scanner.maven</groupId>
    <artifactId>sonar-maven-plugin</artifactId>
    <version>3.10.0.2594</version>
  </plugin>
</plugins>
```

### Checkstyle Configuration

Create `checkstyle.xml`:

```xml
<?xml version="1.0"?>
<!DOCTYPE module PUBLIC
  "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
  "https://checkstyle.org/dtds/configuration_1_3.dtd">

<module name="Checker">
  <property name="charset" value="UTF-8"/>
  <property name="severity" value="warning"/>
  <property name="fileExtensions" value="java, properties, xml"/>

  <!-- Checks for Size Violations -->
  <module name="FileLength"/>
  <module name="LineLength">
    <property name="max" value="120"/>
  </module>

  <!-- Checks for whitespace -->
  <module name="FileTabCharacter"/>

  <module name="TreeWalker">
    <!-- Checks for Naming Conventions -->
    <module name="ConstantName"/>
    <module name="LocalFinalVariableName"/>
    <module name="LocalVariableName"/>
    <module name="MemberName"/>
    <module name="MethodName"/>
    <module name="PackageName"/>
    <module name="ParameterName"/>
    <module name="StaticVariableName"/>
    <module name="TypeName"/>

    <!-- Checks for imports -->
    <module name="AvoidStarImport"/>
    <module name="IllegalImport"/>
    <module name="RedundantImport"/>
    <module name="UnusedImports"/>

    <!-- Checks for Size Violations -->
    <module name="MethodLength"/>
    <module name="ParameterNumber"/>

    <!-- Checks for whitespace -->
    <module name="EmptyForIteratorPad"/>
    <module name="GenericWhitespace"/>
    <module name="MethodParamPad"/>
    <module name="NoWhitespaceAfter"/>
    <module name="NoWhitespaceBefore"/>
    <module name="OperatorWrap"/>
    <module name="ParenPad"/>
    <module name="TypecastParenPad"/>
    <module name="WhitespaceAfter"/>
    <module name="WhitespaceAround"/>
  </module>
</module>
```

## Hot Reload Configuration

### Spring Boot DevTools

Add to your `pom.xml`:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-devtools</artifactId>
  <scope>runtime</scope>
  <optional>true</optional>
</dependency>
```

### IDE Configuration for Hot Reload

**IntelliJ IDEA:**
1. Go to `File > Settings > Build, Execution, Deployment > Compiler`
2. Check "Build project automatically"
3. Go to `File > Settings > Advanced Settings`
4. Check "Allow auto-make to start even if developed application is currently running"

**VS Code:**
Hot reload works automatically with Spring Boot DevTools when files are saved.

## Debug Configuration

### Application Debugging

**IntelliJ IDEA Debug Configuration:**
```text
Run > Edit Configurations > Add New Configuration > Application
- Name: OpenFrame Debug
- Main class: com.example.openframe.Application
- VM options: -Xmx1024m -Xms512m
- Environment variables: Load from .env.development
- Working directory: $MODULE_WORKING_DIR$
```

**VS Code Debug Configuration:**
```json
{
  "type": "java",
  "name": "Debug OpenFrame",
  "request": "launch",
  "mainClass": "com.example.openframe.Application",
  "envFile": "${workspaceFolder}/.env.development",
  "vmArgs": "-Xmx1024m -Xms512m"
}
```

### Remote Debugging

For debugging deployed applications:

```bash
# Start application with debug port
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005 -jar app.jar
```

**IDE Remote Debug Setup:**
- Host: localhost (or remote host)
- Port: 5005
- Debugger mode: Attach

## Performance Profiling

### JProfiler Integration

1. Install JProfiler
2. Configure IDE integration
3. Profile application startup and runtime

### VisualVM (Free Alternative)

```bash
# Install VisualVM
brew install visualvm  # macOS
sudo apt install visualvm  # Ubuntu

# Launch with Java application
visualvm --jdkhome $JAVA_HOME
```

## Troubleshooting Common Issues

### Port Conflicts

```bash
# Find process using port 8080
lsof -i :8080
netstat -tulpn | grep :8080

# Kill process if needed
kill -9 PID
```

### Java Version Issues

```bash
# Check active Java version
java -version

# List available Java versions (macOS)
/usr/libexec/java_home -V

# Switch Java version
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
```

### MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod  # Linux
brew services list | grep mongodb  # macOS

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log  # Linux
tail -f /opt/homebrew/var/log/mongodb/mongo.log  # macOS
```

### Maven Build Issues

```bash
# Clean and rebuild
./mvnw clean compile

# Update dependencies
./mvnw dependency:resolve

# Clear local repository cache
rm -rf ~/.m2/repository
```

## Next Steps

Your development environment is now ready! Continue with:

1. **[Local Development](./local-development.md)** - Learn the development workflow
2. **[Architecture Overview](../architecture/overview.md)** - Understand system architecture
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing

## Support & Resources

- 💬 **Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 📚 **Documentation**: [Development Guide](../README.md)
- 🚀 **Platform**: [OpenFrame.ai](https://openframe.ai)

Happy coding! 🚀