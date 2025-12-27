# Development Environment Setup

Setting up an optimal development environment for OpenFrame OSS Library will significantly improve your productivity and development experience. This guide covers IDE configuration, essential tools, editor extensions, and development workflows.

## 🎯 Overview

A well-configured development environment for OpenFrame should include:

- **Optimized IDE** with Java development features
- **Integrated build tools** (Maven, Git)
- **Code quality tools** (linting, formatting, static analysis)
- **MongoDB integration** for database development
- **Debugging capabilities** with remote debugging support

## 💻 IDE Recommendations

### IntelliJ IDEA (Highly Recommended)

IntelliJ IDEA provides the best experience for OpenFrame development with excellent Java support and Spring Boot integration.

#### Installation

**Option 1: JetBrains Toolbox (Recommended)**
```bash
# Download and install JetBrains Toolbox
# https://www.jetbrains.com/toolbox-app/

# Then install IntelliJ IDEA Ultimate through Toolbox
# Ultimate edition includes advanced database tools and Spring Boot support
```

**Option 2: Direct Download**
```bash
# Community Edition (Free)
# Download from: https://www.jetbrains.com/idea/download/

# Ultimate Edition (Paid, recommended for professional development)
# Includes database integration, Spring Boot tools, and advanced features
```

#### Essential Configuration

**1. Configure JDK**
```text
File → Project Structure → Project Settings → Project
- Project SDK: Java 17 or later
- Project language level: 17 or later

File → Project Structure → Platform Settings → SDKs
- Add JDK: Point to your Java installation
```

**2. Import Code Style**
```text
File → Settings → Editor → Code Style → Java
- Import from: .editorconfig (if available in project)
- Or configure manually:
  - Indent: 4 spaces
  - Continuation indent: 8 spaces  
  - Tab size: 4
  - Use tab character: No
```

**3. Enable Annotation Processing**
```text
File → Settings → Build → Compiler → Annotation Processors
✅ Enable annotation processing
✅ Obtain processors from project classpath
```

#### Essential Plugins

| Plugin | Purpose | Installation |
|--------|---------|-------------|
| **Lombok** | Reduces boilerplate code | Settings → Plugins → Install "Lombok" |
| **Maven Helper** | Enhanced Maven integration | Settings → Plugins → Install "Maven Helper" |
| **Database Navigator** | Database development | Settings → Plugins → Install "Database Navigator" |
| **Docker** | Container management | Settings → Plugins → Install "Docker" |
| **GitToolBox** | Enhanced Git integration | Settings → Plugins → Install "GitToolBox" |
| **SonarLint** | Code quality analysis | Settings → Plugins → Install "SonarLint" |

**Install Plugins Command:**
```text
File → Settings → Plugins → Marketplace
Search and install each plugin above
Restart IDE when prompted
```

### VS Code

VS Code is an excellent free alternative with strong Java support through extensions.

#### Essential Extensions

```bash
# Install VS Code extensions
code --install-extension vscjava.vscode-java-pack
code --install-extension vscjava.vscode-spring-boot-dashboard
code --install-extension ms-vscode.vscode-java-debug
code --install-extension redhat.java
code --install-extension mongodb.mongodb-vscode
code --install-extension ms-azuretools.vscode-docker
code --install-extension gabrielbb.vscode-lombok
```

#### Configuration

Create `.vscode/settings.json`:
```json
{
    "java.home": "/path/to/java/17",
    "java.configuration.runtimes": [
        {
            "name": "JavaSE-17",
            "path": "/path/to/java/17"
        }
    ],
    "java.compile.nullAnalysis.mode": "automatic",
    "java.format.settings.url": "https://raw.githubusercontent.com/google/styleguide/gh-pages/eclipse-java-google-style.xml",
    "editor.tabSize": 4,
    "editor.insertSpaces": true,
    "files.trimTrailingWhitespace": true,
    "mongodb.connectionSaving": "Workspace"
}
```

### Eclipse IDE

Eclipse is a robust, free alternative with excellent Java development features.

#### Installation and Setup
```bash
# Download Eclipse IDE for Enterprise Java Developers
# https://www.eclipse.org/downloads/packages/

# Install Lombok support
# Download lombok.jar from https://projectlombok.org/
java -jar lombok.jar
# Follow installer to configure Eclipse
```

## 🔧 Required Development Tools

### Git Configuration

Configure Git for OpenFrame development:

```bash
# Set identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Configure line endings (important for cross-platform development)
git config --global core.autocrlf input  # Linux/macOS
git config --global core.autocrlf true   # Windows

# Configure default editor
git config --global core.editor "code --wait"  # VS Code
# or
git config --global core.editor "idea --wait"  # IntelliJ

# Configure useful aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'
```

### Maven Integration

Configure Maven for optimal development experience:

**1. Maven Settings (`~/.m2/settings.xml`)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 
          http://maven.apache.org/xsd/settings-1.0.0.xsd">
  
  <profiles>
    <profile>
      <id>openframe-dev</id>
      <properties>
        <!-- Development profile properties -->
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
      </properties>
    </profile>
  </profiles>
  
  <activeProfiles>
    <activeProfile>openframe-dev</activeProfile>
  </activeProfiles>
  
</settings>
```

**2. Maven Wrapper Configuration**
```bash
# Always use the Maven wrapper provided with the project
./mvnw clean install  # Linux/macOS
./mvnw.cmd clean install  # Windows

# This ensures consistent Maven version across development environments
```

## 🗄️ Database Development Tools

### MongoDB Integration

**IntelliJ IDEA Ultimate (Built-in)**
```text
View → Tool Windows → Database
Add → MongoDB
Configure connection:
- Host: localhost
- Port: 27017
- Authentication: None (for local development)
- Database: openframe-dev
```

**VS Code with MongoDB Extension**
```bash
# Extension provides:
# - Connection management
# - Query execution
# - Document viewing and editing
# - Schema exploration

# Connect using Command Palette:
Ctrl+Shift+P → "MongoDB: Connect"
# Or click MongoDB icon in activity bar
```

**MongoDB Compass (Standalone GUI)**
```bash
# Download from: https://www.mongodb.com/products/compass
# Provides visual database management
# Connection string for local development:
mongodb://localhost:27017/openframe-dev
```

### Database Connection Testing

Create a test connection script:

```java
// DatabaseConnectionTest.java
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;

public class DatabaseConnectionTest {
    public static void main(String[] args) {
        try {
            String connectionString = "mongodb://localhost:27017";
            MongoClient mongoClient = MongoClients.create(connectionString);
            MongoDatabase database = mongoClient.getDatabase("openframe-dev");
            
            System.out.println("✅ Successfully connected to MongoDB");
            System.out.println("Database: " + database.getName());
            
            mongoClient.close();
        } catch (Exception e) {
            System.err.println("❌ Failed to connect to MongoDB: " + e.getMessage());
        }
    }
}
```

## 🧪 Code Quality Tools

### SonarLint Integration

**IntelliJ IDEA**
```text
Settings → Plugins → Install "SonarLint"
Settings → Tools → SonarLint
- Automatically trigger analysis: ✅
- Show verbose logs: ✅
- Include test files: ✅
```

**VS Code**
```bash
code --install-extension sonarlint.sonarlint-vscode

# Configure in VS Code settings:
{
    "sonarlint.analyzerProperties": {
        "sonar.java.source": "17"
    }
}
```

### Code Formatting

**EditorConfig (Recommended)**

Create `.editorconfig` in project root:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.java]
indent_style = space
indent_size = 4
max_line_length = 120

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.xml]
indent_style = space
indent_size = 2

[*.json]
indent_style = space
indent_size = 2
```

**Google Java Style (Alternative)**
```bash
# Download Google Java Style configuration
# IntelliJ: https://github.com/google/styleguide/blob/gh-pages/intellij-java-google-style.xml
# Eclipse: https://github.com/google/styleguide/blob/gh-pages/eclipse-java-google-style.xml

# Import in IDE:
# IntelliJ: Settings → Editor → Code Style → Java → Import Scheme
# Eclipse: Preferences → Java → Code Style → Formatter → Import
```

## 🐳 Docker Integration

### Docker for Development Services

**Docker Compose for Local Services**

Create `docker-compose.dev.yml`:
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    container_name: openframe-dev-mongo
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=openframe-dev
    volumes:
      - mongodb_data:/data/db
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all"]

  mongo-express:
    image: mongo-express
    container_name: openframe-dev-mongo-express
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_URL=mongodb://mongodb:27017/
      - ME_CONFIG_BASICAUTH_USERNAME=admin
      - ME_CONFIG_BASICAUTH_PASSWORD=admin
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

**Start Development Services**
```bash
# Start MongoDB and Mongo Express
docker-compose -f docker-compose.dev.yml up -d

# Initialize MongoDB replica set (required for transactions)
docker exec openframe-dev-mongo mongosh --eval "rs.initiate()"

# Access Mongo Express at http://localhost:8081
# Username: admin, Password: admin
```

## 🔍 Debugging Configuration

### Remote Debugging Setup

**Maven Configuration**
```xml
<!-- Add to pom.xml for debug profile -->
<profiles>
    <profile>
        <id>debug</id>
        <properties>
            <spring-boot.run.jvmArguments>
                -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005
            </spring-boot.run.jvmArguments>
        </properties>
    </profile>
</profiles>
```

**Run with Debug Profile**
```bash
# Start application with remote debugging enabled
mvn spring-boot:run -Pdebug

# Application will accept debugger connections on port 5005
```

**IDE Debug Configuration**

**IntelliJ IDEA**
```text
Run → Edit Configurations → Add New → Remote JVM Debug
- Host: localhost
- Port: 5005
- Use module classpath: Select your project module
```

**VS Code**
```json
// Add to .vscode/launch.json
{
    "type": "java",
    "name": "Attach to OpenFrame",
    "request": "attach",
    "hostName": "localhost",
    "port": 5005
}
```

## ⚙️ Environment Variables

### Development Environment Variables

Create `.env.development`:
```bash
# Database
MONGODB_URL=mongodb://localhost:27017/openframe-dev
MONGODB_DATABASE=openframe-dev

# Logging
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_COM_OPENFRAME=DEBUG
LOGGING_PATTERN_CONSOLE=%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n

# Development flags
SPRING_PROFILES_ACTIVE=development
OPENFRAME_ENV=development

# Debug configuration
JAVA_TOOL_OPTIONS=-agentlib:jdwp=transport=dt_socket,address=5005,server=y,suspend=n
```

**Load Environment Variables**
```bash
# In your shell profile (.bashrc, .zshrc, etc.)
if [ -f .env.development ]; then
    export $(cat .env.development | xargs)
fi

# Or use direnv for automatic loading
# https://direnv.net/
```

## ✅ Environment Validation

### Validation Script

Create `validate-dev-environment.sh`:
```bash
#!/bin/bash
echo "🔍 Validating OpenFrame Development Environment..."

# Check Java
echo "Checking Java..."
if java -version 2>&1 | grep -q "17\|18\|19\|20\|21"; then
    echo "✅ Java 17+ detected"
else
    echo "❌ Java 17+ required"
fi

# Check Maven
echo "Checking Maven..."
if mvn --version > /dev/null 2>&1; then
    echo "✅ Maven detected"
else
    echo "❌ Maven not found"
fi

# Check Git
echo "Checking Git..."
if git --version > /dev/null 2>&1; then
    echo "✅ Git detected"
else
    echo "❌ Git not found"
fi

# Check MongoDB connection
echo "Checking MongoDB..."
if mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB connection successful"
else
    echo "⚠️ MongoDB not accessible (optional for library development)"
fi

# Check Docker
echo "Checking Docker..."
if docker --version > /dev/null 2>&1; then
    echo "✅ Docker detected"
else
    echo "⚠️ Docker not found (recommended for services)"
fi

echo "🎉 Environment validation complete!"
```

Run validation:
```bash
chmod +x validate-dev-environment.sh
./validate-dev-environment.sh
```

## 🚀 Next Steps

Once your development environment is set up:

1. **[Continue to Local Development](local-development.md)** - Clone and build the project
2. **[Explore Architecture](../architecture/overview.md)** - Understand the system design  
3. **[Review Contributing Guidelines](../contributing/guidelines.md)** - Learn the contribution process

## 🆘 Troubleshooting

### Common Issues

**Lombok Not Working**
```bash
# IntelliJ IDEA
# Settings → Plugins → Ensure Lombok plugin is installed and enabled
# Settings → Build → Compiler → Annotation Processors → Enable annotation processing

# VS Code  
# Ensure Extension Pack for Java is installed
# Check that lombok is in project dependencies

# Eclipse
# Download lombok.jar and run: java -jar lombok.jar
# Restart Eclipse after installation
```

**Maven Build Issues**
```bash
# Clear local repository
rm -rf ~/.m2/repository/com/openframe

# Update dependencies
mvn clean install -U

# Skip tests if needed during setup
mvn clean install -DskipTests
```

**Database Connection Issues**
```bash
# Check MongoDB status
docker ps | grep mongo

# Restart MongoDB
docker-compose -f docker-compose.dev.yml restart mongodb

# Check connection
mongosh mongodb://localhost:27017/openframe-dev
```

## 🤝 Get Help

- **Slack Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Development Channel**: `#openframe-dev` on Slack
- **Documentation**: Continue reading the development guides

---

**Great job setting up your development environment!** You're now ready to dive into local development.