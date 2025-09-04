# Kafka Producers Usage Guide

## Overview

The library provides several ways to work with different Kafka clusters:

1. **Specialized Producers for different clusters** (recommended) - ready beans for each cluster
2. **Low-level beans** - `KafkaTemplate`, `KafkaAdmin`, etc.
3. **Creating custom GenericKafkaProducer** - for special cases

## 1. Ready Specialized Producers for different clusters (recommended)

### Tenant cluster (main cluster)

```java
@Service
public class UserService {
    
    private final KafkaProducer tenantProducer;
    
    public UserService(@Qualifier("kafkaProducer") KafkaProducer tenantProducer) {
        this.tenantProducer = tenantProducer;
    }
    
    // Send without key
    public void notifyUserCreated(UserEvent event) {
        tenantProducer.sendMessage("user.events", event);
    }
    
    // Send with key
    public void notifyUserCreatedWithKey(UserEvent event) {
        tenantProducer.sendMessage("user.events", event.getUserId(), event);
    }
}
```

### Shared cluster

```java
@Service
public class ConfigService {
    
    private final SharedKafkaProducer sharedProducer;
    
    // Shared cluster may not be configured - use @Autowired(required = false)
    public ConfigService(@Qualifier("sharedKafkaProducer") @Autowired(required = false) SharedKafkaProducer sharedProducer) {
        this.sharedProducer = sharedProducer;
    }
    
    public void broadcastConfigChange(ConfigEvent event) {
        if (sharedProducer != null) {
            sharedProducer.sendMessage("config.events", event.getKey(), event);
        } else {
            log.warn("Shared cluster not configured, config event not sent: {}", event);
        }
    }
}
```

## 2. Using GenericKafkaProducer with different clusters

### Creating GenericKafkaProducer for different clusters

```java
@Configuration
public class CustomProducerConfig {
    
    // GenericKafkaProducer for tenant cluster
    @Bean("tenantGenericProducer")
    public GenericKafkaProducer tenantGenericProducer(
            @Qualifier("kafkaTemplate") KafkaTemplate<String, Object> tenantTemplate) {
        return new GenericKafkaProducer(tenantTemplate);
    }
    
    // GenericKafkaProducer for shared cluster (conditional)
    @Bean("sharedGenericProducer")
    @ConditionalOnBean(name = "sharedKafkaTemplate")
    public GenericKafkaProducer sharedGenericProducer(
            @Qualifier("sharedKafkaTemplate") KafkaTemplate<String, Object> sharedTemplate) {
        return new GenericKafkaProducer(sharedTemplate);
    }
}
```

### Using GenericKafkaProducer

```java
@Service
public class GenericProducerService {
    
    private final GenericKafkaProducer tenantGenericProducer;
    private final GenericKafkaProducer sharedGenericProducer;
    
    public GenericProducerService(
            @Qualifier("tenantGenericProducer") GenericKafkaProducer tenantGenericProducer,
            @Qualifier("sharedGenericProducer") @Autowired(required = false) GenericKafkaProducer sharedGenericProducer) {
        this.tenantGenericProducer = tenantGenericProducer;
        this.sharedGenericProducer = sharedGenericProducer;
    }
    
    public void sendToTenant(String topic, Object message) {
        tenantGenericProducer.sendMessage(topic, message);
    }
    
    public void sendToTenantWithKey(String topic, String key, Object message) {
        tenantGenericProducer.sendMessage(topic, key, message);
    }
    
    public void sendToShared(String topic, Object message) {
        if (sharedGenericProducer != null) {
            sharedGenericProducer.sendMessage(topic, message);
        } else {
            throw new IllegalStateException("Shared cluster not configured");
        }
    }
}
```

## 3. Complex usage example

```java
@Service
public class MessageService {
    
    // Specialized producers (recommended)
    private final KafkaProducer tenantProducer;
    private final SharedKafkaProducer sharedProducer;
    
    // GenericKafkaProducer for special cases
    private final GenericKafkaProducer tenantGenericProducer;
    private final GenericKafkaProducer sharedGenericProducer;
    
    public MessageService(
            @Qualifier("kafkaProducer") KafkaProducer tenantProducer,
            @Qualifier("sharedKafkaProducer") @Autowired(required = false) SharedKafkaProducer sharedProducer,
            @Qualifier("tenantGenericProducer") GenericKafkaProducer tenantGenericProducer,
            @Qualifier("sharedGenericProducer") @Autowired(required = false) GenericKafkaProducer sharedGenericProducer) {
        this.tenantProducer = tenantProducer;
        this.sharedProducer = sharedProducer;
        this.tenantGenericProducer = tenantGenericProducer;
        this.sharedGenericProducer = sharedGenericProducer;
    }
    
    // Using specialized producer
    public void processUserEvent(UserEvent event) {
        tenantProducer.sendMessage("user.events", event.getUserId(), event);
        log.info("User event sent successfully: {}", event);
        
        // If shared cluster exists, send analytics there
        if (sharedProducer != null) {
            var analyticsEvent = createAnalyticsEvent(event);
            sharedProducer.sendMessage("analytics.events", analyticsEvent);
        }
    }
    
    // Using GenericKafkaProducer for special cases
    public void sendRawMessage(String clusterType, String topic, String rawMessage) {
        switch (clusterType.toLowerCase()) {
            case "tenant":
                tenantGenericProducer.sendMessage(topic, rawMessage);
                break;
            case "shared":
                if (sharedGenericProducer != null) {
                    sharedGenericProducer.sendMessage(topic, rawMessage);
                } else {
                    throw new IllegalStateException("Shared cluster not configured");
                }
                break;
            default:
                throw new IllegalArgumentException("Unknown cluster type: " + clusterType);
        }
    }
    
    // Broadcast message to both clusters
    public void broadcastMessage(String topic, Object message) {
        // Send to tenant cluster
        tenantProducer.sendMessage(topic, message);
        
        // Send to shared cluster if available
        if (sharedProducer != null) {
            sharedProducer.sendMessage(topic, message);
        }
    }
    
    private AnalyticsEvent createAnalyticsEvent(UserEvent userEvent) {
        // Logic for creating analytics event
        return new AnalyticsEvent(userEvent.getUserId(), userEvent.getAction(), System.currentTimeMillis());
    }
}
```

## 4. Configuration

### application.yml

```yaml
spring:
  kafka:
    # Main/tenant cluster (standard)
    bootstrap-servers: tenant-kafka:9092
    producer:
      acks: all
      retries: 3
    consumer:
      group-id: tenant-group
    
  # Shared cluster (optional)
  shared-kafka:
    bootstrap-servers: shared-kafka:9092  # Presence of this parameter activates shared cluster
    producer:
      acks: 1
    consumer:
      group-id: shared-group
```

## 5. Recommendations

1. **Use specialized producers** (`KafkaProducer`, `SharedKafkaProducer`) for most cases
2. **GenericKafkaProducer** is suitable for special cases or migrating existing code
3. **Always check shared cluster availability** using `@Autowired(required = false)`
4. **Use proper exception handling** and logging
5. **Consider performance** when choosing between synchronous and asynchronous sending

## 6. Migration from GenericKafkaProducer

If you already have code with `GenericKafkaProducer`, you can:

### Option 1: Create GenericKafkaProducer beans for different clusters

```java
// Old code
@Autowired
private GenericKafkaProducer kafkaProducer;

// New code
@Autowired
@Qualifier("tenantGenericProducer")
private GenericKafkaProducer tenantKafkaProducer;

@Autowired(required = false)
@Qualifier("sharedGenericProducer")
private GenericKafkaProducer sharedKafkaProducer;
```

### Option 2: Migrate to specialized producers

```java
// Old code
kafkaProducer.sendMessage("topic", message);

// New code
tenantProducer.sendMessage("topic", message);
```

Specialized producers provide additional capabilities:
- Better logging
- Error handling
- Type-safe methods
- Clear cluster separation