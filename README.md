<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/flamingo-stack/openframe-oss-tenant/main/docs/assets/logo-openframe-full-dark-bg.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/flamingo-stack/openframe-oss-tenant/main/docs/assets/logo-openframe-full-light-bg.png">
    <img alt="OpenFrame Logo" src="https://raw.githubusercontent.com/flamingo-stack/openframe-oss-tenant/main/docs/assets/logo-openframe-full-light-bg.png" width="400">
  </picture>
</div>

<p align="center">
  <a href="LICENSE.md"><img alt="License" src="https://img.shields.io/badge/LICENSE-FLAMINGO%20AI%20Unified%20v1.0-%23FFC109?style=for-the-badge&labelColor=white"></a>
</p>

# OpenFrame OSS Library

The foundational library for secure, scalable device and organization management platforms. OpenFrame OSS Library provides standardized data models, API DTOs, and service interfaces that power the entire OpenFrame ecosystem, enabling organizations to build robust, multi-tenant device management solutions.

[![OpenFrame Preview Webinar](https://img.youtube.com/vi/bINdW0CQbvY/maxresdefault.jpg)](https://www.youtube.com/watch?v=bINdW0CQbvY)

## ✨ Features

### 🏢 Multi-Tenant Organization Management
- Complete organization structure with contact management
- User invitation and role-based access control
- SSO configuration support with OAuth 2.0 and OIDC
- Tenant isolation and security

### 💻 Comprehensive Device Management
- Device inventory and tracking across multiple types (Desktop, Laptop, Server)
- Health monitoring and compliance tracking
- Integration with popular MDM tools (Fleet, Tactical RMM, MeshCentral)
- Real-time device status and alerts

### 📊 Event & Audit System
- Centralized event logging and tracking
- Comprehensive audit trail capabilities
- Flexible filtering and cursor-based pagination
- Real-time event processing with Kafka streams

### 🔧 Extensible Tool Integration
- Plugin architecture for tool connections
- API key and credential management
- Tool agent installation and management
- Support for external RMM integrations

### 🔐 Enterprise Security
- JWT-based authentication with refresh tokens
- OAuth 2.0 and OIDC provider support
- API key management with rate limiting
- Multi-tenant data isolation

### 📚 Developer Experience
- Standardized DTOs for consistent API responses
- Service interfaces for business logic abstraction
- MongoDB data models with optimized queries
- Comprehensive documentation and examples

## 🚀 Quick Start

### Prerequisites
- Java 21 or higher
- Maven 3.6+
- MongoDB 7.0+
- Redis 7.0+ (optional, for caching)

### 1. Add Dependency

```xml
<dependency>
    <groupId>com.openframe</groupId>
    <artifactId>openframe-oss-lib</artifactId>
    <version>latest</version>
</dependency>
```

### 2. Configure Application

```yaml
# application.yml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe
      
openframe:
  security:
    jwt:
      secret: your-jwt-secret
    oauth:
      enabled: true
```

### 3. Use in Your Service

```java
@Service
public class DeviceManagementService {
    
    @Autowired
    private DeviceRepository deviceRepository;
    
    public PageResponse<DeviceResponse> getDevices(DeviceFilter filter) {
        // Use OpenFrame DTOs and pagination
        return deviceRepository.findDevicesWithFilter(filter);
    }
}
```

### 4. Run Your Application

```bash
mvn spring-boot:run
```

Your OpenFrame-powered application is now running! 🎉

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Your Applications"
        WEB[Web Dashboard]
        API[REST APIs]
        CLI[CLI Tools]
    end
    
    subgraph "OpenFrame OSS Library"
        DTOS[API DTOs]
        SERVICES[Service Interfaces] 
        MODELS[Data Models]
        CONFIG[Configuration]
        UTILS[Utilities]
    end
    
    subgraph "Data & Infrastructure"
        MONGO[(MongoDB)]
        REDIS[(Redis Cache)]
        KAFKA[Event Streams]
    end
    
    WEB --> DTOS
    API --> SERVICES
    CLI --> MODELS
    
    SERVICES --> MONGO
    CONFIG --> REDIS
    MODELS --> KAFKA
```

## 📚 Core Modules

| Module | Purpose | Key Components |
|--------|---------|----------------|
| **API DTOs** | Standardized data transfer | `DeviceResponse`, `OrganizationRequest`, `EventFilter` |
| **Service Interfaces** | Business logic contracts | `DeviceService`, `OrganizationService`, `EventService` |
| **Data Models** | MongoDB entities | Device, Organization, Event, Tool documents |
| **Security Core** | Authentication & authorization | JWT handlers, OAuth providers, tenant isolation |
| **Core Utilities** | Shared functionality | Pagination, validation, encryption, slug generation |

## 🔄 Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Library
    participant MongoDB
    
    Client->>Controller: API Request
    Controller->>Service: Business Logic
    Service->>Library: Use DTOs & Models
    Library->>MongoDB: Query/Update
    MongoDB-->>Library: Results
    Library-->>Service: Mapped Response
    Service-->>Controller: DTO Response
    Controller-->>Client: JSON Response
```

## 🛠️ Use Cases

### MSP/IT Service Providers
Build centralized device management dashboards with multi-client support, automated monitoring, and compliance reporting.

### Enterprise Organizations  
Deploy secure, scalable device management infrastructure with SSO integration, audit trails, and policy enforcement.

### Software Vendors
Integrate device management capabilities into existing products using standardized APIs and data models.

### Platform Developers
Create custom device management solutions with battle-tested components and patterns.

## 🎯 What You Can Build

- **Device Management Platforms** - Inventory, monitoring, and compliance
- **IT Service Dashboards** - Multi-tenant MSP solutions  
- **Security Monitoring** - Device security and compliance tracking
- **Integration Platforms** - Connect RMM tools and monitoring systems
- **Analytics Dashboards** - Device usage and health analytics
- **Mobile Device Management** - Enterprise mobility solutions

## 📖 Documentation

📚 See the [Documentation](./docs/README.md) for comprehensive guides including:

- **[Getting Started](./docs/getting-started/introduction.md)** - Introduction and quick setup
- **[Development Guide](./docs/development/README.md)** - Architecture and development patterns  
- **[API Reference](./docs/reference/architecture/overview.md)** - Complete API documentation
- **[Examples](./examples)** - Real-world usage examples

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details on:

- Code standards and style guide
- Pull request process
- Issue reporting
- Development setup
- Testing requirements

## 📄 License

Licensed under the [Flamingo AI Unified License v1.0](./LICENSE.md) - see the license file for details.

## 🆘 Support

- 📖 **Documentation**: [Complete guides and API reference](./docs/README.md)
- 💬 **Community Discussions**: [GitHub Discussions](https://github.com/flamingo-stack/openframe-oss-lib/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- 💼 **Enterprise Support**: [Contact our team](mailto:enterprise@openframe.ai)

## 🚀 Ecosystem

OpenFrame OSS Library is part of the larger OpenFrame ecosystem:

- **[OpenFrame Platform](https://openframe.ai)** - Complete device management solution
- **[OpenFrame Gateway](https://github.com/flamingo-stack/openframe-gateway)** - API gateway and routing
- **[OpenFrame Auth](https://github.com/flamingo-stack/openframe-auth)** - Authentication service
- **[OpenFrame Dashboard](https://github.com/flamingo-stack/openframe-dashboard)** - Web interface

---

<div align="center">
  Built with 💛 by the <a href="https://www.flamingo.run/about"><b>Flamingo</b></a> team
</div>