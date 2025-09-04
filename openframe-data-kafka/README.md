# OpenFrame Data Kafka

Library for working with Apache Kafka within the OpenFrame ecosystem.

## Features

- Support for two Kafka clusters simultaneously (main/tenant and shared)
- Auto-configuration with full support for all Spring Kafka parameters
- Ready-to-use beans for Producer, Consumer, Admin, Streams for each cluster

## Configuration

### Main/Tenant Kafka cluster (standard prefix)

```yaml
spring:
  kafka:
    enabled: true  # enabled by default
    bootstrap-servers: tenant-kafka:9092
    client-id: tenant-client
    producer:
      acks: all
      retries: 3
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      group-id: tenant-group
      auto-offset-reset: latest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
    listener:
      ack-mode: record
      concurrency: 3
      poll-timeout: 3s
    admin:
      fail-fast: true
    ssl:
      enabled: false
    properties:
      # any additional Kafka properties
      security.protocol: PLAINTEXT
```

### Shared Kafka cluster (activated only when configuration is present)

```yaml
spring:
  shared-kafka:
    # Presence of bootstrap-servers automatically activates shared cluster
    bootstrap-servers: shared-kafka:9092
    client-id: shared-client
    producer:
      acks: 1
      batch-size: 16384
    consumer:
      group-id: shared-group
      auto-offset-reset: earliest
    listener:
      ack-mode: batch
      concurrency: 5
    streams:
      application-id: shared-streams-app
      replication-factor: 3
```

## Usage

### KafkaProducer for different clusters (recommended)

```java
@Service
public class KafkaService {
    
    private final KafkaProducer tenantProducer;
    private final SharedKafkaProducer sharedProducer;
    
    public KafkaService(
            @Qualifier("kafkaProducer") KafkaProducer tenantProducer,
            @Qualifier("sharedKafkaProducer") @Autowired(required = false) SharedKafkaProducer sharedProducer) {
        this.tenantProducer = tenantProducer;
        this.sharedProducer = sharedProducer;
    }
    
    // Send to tenant cluster
    public void sendToTenant(String topic, Object message) {
        tenantProducer.sendMessage(topic, message);
    }
    
    // Send with key to tenant cluster
    public void sendToTenant(String topic, String key, Object message) {
        tenantProducer.sendMessage(topic, key, message);
    }
    
    // Send to shared cluster (if configured)
    public void sendToShared(String topic, Object message) {
        if (sharedProducer != null) {
            sharedProducer.sendMessage(topic, message);
        }
    }
    
    // Send with key to shared cluster (if configured)
    public void sendToShared(String topic, String key, Object message) {
        if (sharedProducer != null) {
            sharedProducer.sendMessage(topic, key, message);
        }
    }
}
```

### Low-level beans (for advanced usage)

```java
@Service
public class AdvancedKafkaService {
    
    // Tenant cluster
    @Autowired
    @Qualifier("kafkaTemplate")
    private KafkaTemplate<String, Object> tenantTemplate;
    
    // Shared cluster (optional)
    @Autowired(required = false)
    @Qualifier("sharedKafkaTemplate")
    private KafkaTemplate<String, Object> sharedTemplate;
    
    public void sendToTenant(String topic, Object message) {
        tenantTemplate.send(topic, message);
    }
    
    public void sendToShared(String topic, Object message) {
        if (sharedTemplate != null) {
            sharedTemplate.send(topic, message);
        }
    }
}
```

### Kafka Listeners

```java
@Component
public class MessageListeners {
    
    // Listener for main/tenant cluster (standard)
    @KafkaListener(
        topics = "tenant-topic",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleTenantMessage(String message) {
        // process message from main/tenant cluster
    }
    
    // Listener for shared cluster (if configured)
    @KafkaListener(
        topics = "shared-topic", 
        containerFactory = "sharedKafkaListenerContainerFactory"
    )
    public void handleSharedMessage(String message) {
        // process message from shared cluster
    }
}
```

## Available Beans

### Main/Tenant cluster (standard spring.kafka)

#### Producers:
- `kafkaProducer` - KafkaProducer for tenant cluster (recommended)

#### Low-level beans:
- `kafkaProducerFactory` - ProducerFactory
- `kafkaTemplate` - KafkaTemplate
- `kafkaConsumerFactory` - ConsumerFactory  
- `kafkaListenerContainerFactory` - ConcurrentKafkaListenerContainerFactory

### Shared cluster (spring.shared-kafka, only when bootstrap-servers is present)

#### Producers:
- `sharedKafkaProducer` - SharedKafkaProducer for shared cluster (recommended)

#### Low-level beans:
- `sharedKafkaProducerFactory` - ProducerFactory
- `sharedKafkaTemplate` - KafkaTemplate
- `sharedKafkaConsumerFactory` - ConsumerFactory
- `sharedKafkaListenerContainerFactory` - ConcurrentKafkaListenerContainerFactory

## Supported Parameters

The library supports all parameters of standard `spring.kafka.*`, including:

- `bootstrap-servers` - broker addresses
- `client-id` - client identifier
- `producer.*` - producer settings (acks, retries, batch-size, etc.)
- `consumer.*` - consumer settings (group-id, auto-offset-reset, etc.)
- `listener.*` - listener settings (ack-mode, concurrency, poll-timeout, etc.)
- `admin.*` - admin settings (fail-fast, etc.)
- `streams.*` - Kafka Streams settings (application-id, replication-factor, etc.)
- `ssl.*` - SSL settings
- `security.*` - security settings
- `properties.*` - any additional Kafka properties