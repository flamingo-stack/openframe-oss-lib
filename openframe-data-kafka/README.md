# OpenFrame Data Kafka

Library for working with Apache Kafka within the OpenFrame ecosystem.

## Features

- Support Kafka cluster
- Auto-configuration with full support for all Spring Kafka parameters
- Ready-to-use beans for Producer, Consumer, Admin, Streams for each cluster
- Debezium message model support

## Configuration

### OSS/Tenant Kafka cluster (primary cluster)

```yaml
spring:
  oss-tenant:
    enabled: true  # enabled by default
    kafka:
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

## Usage

### Message Producers for different clusters (recommended)

```java
@Service
public class KafkaService {
    
    private final OssTenantMessageProducer ossTenantProducer;
    
    public KafkaService(
            OssTenantMessageProducer ossTenantProducer) {
        this.ossTenantProducer = ossTenantProducer;
    }
    
    // Send to OSS/Tenant cluster
    public void sendToOssTenant(String topic, Object message) {
        ossTenantProducer.sendMessage(topic, message, null);
    }
    
    // Send with key to OSS/Tenant cluster
    public void sendToOssTenant(String topic, String key, Object message) {
        ossTenantProducer.sendMessage(topic, message, key);
    }
    
}
```

### Low-level beans (for advanced usage)

```java
@Service
public class AdvancedKafkaService {
    
    // OSS/Tenant cluster
    @Autowired
    private KafkaTemplate<String, Object> ossTenantKafkaTemplate;
    
    public void sendToOssTenant(String topic, Object message) {
        ossTenantKafkaTemplate.send(topic, message);
    }
    
}
```

### Kafka Listeners

```java
@Component
public class MessageListeners {
    
    // Listener for OSS/Tenant cluster (primary)
    @KafkaListener(
        topics = "oss-tenant-topic",
        containerFactory = "ossTenantKafkaListenerContainerFactory"
    )
    public void handleOssTenantMessage(String message) {
        // process message from OSS/Tenant cluster
    }
}
```

## Available Beans

### OSS/Tenant cluster (spring.oss-tenant.kafka)

#### Message Producers:
- `ossTenantMessageProducer` - OssTenantMessageProducer for OSS/Tenant cluster (recommended)

#### Low-level beans:
- `ossTenantKafkaProducerFactory` - ProducerFactory
- `ossTenantKafkaTemplate` - KafkaTemplate
- `ossTenantKafkaConsumerFactory` - ConsumerFactory  
- `ossTenantKafkaListenerContainerFactory` - ConcurrentKafkaListenerContainerFactory

## Supported Parameters

The library supports all parameters of standard `spring.kafka.*` under the `kafka` sub-property for each cluster:

### OSS/Tenant cluster (spring.oss-tenant.kafka.*)
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

## Additional Features

### Debezium Message Support
The library includes built-in support for Debezium CDC messages with the `DebeziumMessage<T>` model class, providing structured access to:
- `payload.before` - state before change
- `payload.after` - state after change  
- `payload.operation` - operation type (c/u/d/r)
- `payload.source` - source metadata (database, table, timestamp, etc.)

### Error Handling and Logging
The `GenericKafkaProducer` provides comprehensive error handling with detailed logging for different failure scenarios:
- Authorization errors
- Record too large errors
- Timeout errors
- Retriable exceptions
- Serialization failures