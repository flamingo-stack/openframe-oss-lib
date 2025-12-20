# Getting Started with OpenFrame OSS Library

Welcome to OpenFrame OSS Library! This guide will help you get started with using our comprehensive library for managing agents, tools, and organizations in your OpenFrame ecosystem.

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Purpose | Installation Link |
|-------------|---------|---------|-------------------|
| Java | 17 or higher | Runtime environment | [Download OpenJDK](https://openjdk.java.net/install/) |
| Maven | 3.8+ | Build and dependency management | [Download Maven](https://maven.apache.org/install.html) |
| Git | Latest | Version control | [Download Git](https://git-scm.com/downloads) |
| MongoDB | 4.4+ | Database for storing organizations and events | [Download MongoDB](https://www.mongodb.com/try/download/community) |

> **Note**: If you're using a managed MongoDB service like MongoDB Atlas, you don't need to install MongoDB locally.

## Installation Steps

### Step 1: Add Dependency to Your Project

Add the OpenFrame OSS Library to your Maven `pom.xml`:

```xml
<dependency>
    <groupId>com.openframe</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Step 2: Configure Your Application

Create an `application.yml` file in your `src/main/resources` directory:

```yaml
openframe:
  mongodb:
    uri: mongodb://localhost:27017/openframe
    database: openframe
  
  logging:
    level:
      com.openframe: INFO
```

### Step 3: Initialize Basic Configuration

Create a configuration class in your application:

```java
@Configuration
@EnableConfigurationProperties
public class OpenFrameConfig {
    
    @Value("${openframe.mongodb.uri}")
    private String mongoUri;
    
    @Bean
    public MongoClient mongoClient() {
        return MongoClients.create(mongoUri);
    }
}
```

## Setup Process Flow

```mermaid
flowchart TD
    A[Install Prerequisites] --> B[Add Maven Dependency]
    B --> C[Configure Database Connection]
    C --> D[Create Configuration Class]
    D --> E[Run Your First Query]
    E --> F[Setup Complete]
    
    style A fill:#e1f5fe
    style F fill:#c8e6c9
```

## Your First Organization Setup

Once you have the library configured, let's create your first organization:

### Step 1: Create an Organization

```java
@Service
public class OrganizationService {
    
    public void createFirstOrganization() {
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
            .name("My Company")
            .category("Technology")
            .numberOfEmployees(50)
            .websiteUrl("https://mycompany.com")
            .contactInformation(ContactInformationDto.builder()
                .email("info@mycompany.com")
                .phone("+1-555-0123")
                .build())
            .monthlyRevenue(new BigDecimal("25000.00"))
            .contractStartDate(LocalDate.now())
            .contractEndDate(LocalDate.now().plusYears(1))
            .build();
            
        // Process the organization creation
        System.out.println("Organization created: " + request.name());
    }
}
```

### Step 2: Query Data with Filters

Use the built-in filtering capabilities to find organizations:

```java
@Component
public class OrganizationQueryExample {
    
    public void queryOrganizations() {
        // Create filter options
        OrganizationFilterOptions filterOptions = OrganizationFilterOptions.builder()
            .nameContains("Company")
            .categoryEquals("Technology")
            .minEmployees(10)
            .maxEmployees(100)
            .build();
            
        // The filter options can be used with your query service
        System.out.println("Searching organizations with filters applied");
    }
}
```

## Common Configuration Options

| Configuration | Description | Default | Example |
|---------------|-------------|---------|---------|
| `openframe.mongodb.uri` | MongoDB connection string | `mongodb://localhost:27017/openframe` | `mongodb://user:pass@host:port/db` |
| `openframe.logging.level` | Logging level | `INFO` | `DEBUG`, `WARN`, `ERROR` |
| `openframe.pagination.defaultSize` | Default page size for queries | `20` | `50`, `100` |
| `openframe.cache.enabled` | Enable caching | `true` | `false` |

## Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Connection Refused** | `MongoException: Connection refused` | Verify MongoDB is running and accessible |
| **ClassNotFoundException** | Missing OpenFrame classes | Ensure Maven dependency is correctly added |
| **Validation Errors** | `ConstraintViolationException` | Check required fields in DTOs (name, positive numbers) |
| **Permission Denied** | Database access errors | Verify MongoDB user has read/write permissions |

## Verification Steps

To verify your setup is working correctly:

1. **Check Database Connection**:
```java
@Component
public class HealthCheck {
    
    @Autowired
    private MongoClient mongoClient;
    
    public void testConnection() {
        try {
            mongoClient.getDatabase("openframe").runCommand(new Document("ping", 1));
            System.out.println("✅ Database connection successful");
        } catch (Exception e) {
            System.out.println("❌ Database connection failed: " + e.getMessage());
        }
    }
}
```

2. **Test Basic Query**:
```java
public void testBasicQuery() {
    GenericQueryResult<Organization> result = GenericQueryResult.<Organization>builder()
        .items(Arrays.asList())  // Empty list for test
        .pageInfo(CursorPageInfo.builder().hasNextPage(false).build())
        .build();
        
    System.out.println("✅ Query structure working");
}
```

## Next Steps

Now that you have OpenFrame OSS Library set up, you can:

- 📖 Read our [Common Use Cases Guide](common-use-cases.md) for practical examples
- 🔧 Explore device and agent management features
- 📊 Set up event filtering and logging
- 🔍 Implement advanced querying with pagination

## Getting Help

> **Need assistance?** Check our troubleshooting guide or visit our community forums for help with common issues.

**Congratulations!** You've successfully set up OpenFrame OSS Library. Your system is now ready to manage organizations, devices, and agents efficiently.