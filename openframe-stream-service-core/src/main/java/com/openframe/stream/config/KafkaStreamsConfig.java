package com.openframe.stream.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.stream.model.fleet.ActivityMessage;
import com.openframe.stream.model.fleet.HostActivityMessage;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafkaStreams;
import org.springframework.kafka.annotation.KafkaStreamsDefaultConfiguration;
import org.springframework.kafka.config.KafkaStreamsConfiguration;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerde;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

/**
 * Configuration for Kafka Streams processing
 * Sets up stream processing properties, serializers, and application settings
 */
@Configuration
@EnableKafkaStreams
@ConditionalOnProperty(name = "kafka.stream.enabled", havingValue = "true", matchIfMissing = true)
public class KafkaStreamsConfig {

    // Consumer/producer/state-dir tuning defaults, externally overridable via
    // openframe.stream.kafka-streams.* properties (see KafkaStreamsProperties)
    private static final int DEFAULT_NUM_STREAM_THREADS = 1;
    private static final String DEFAULT_STATE_DIR_BASE = "/tmp/kafka-streams";
    private static final int DEFAULT_MAX_POLL_RECORDS = 100;
    private static final int DEFAULT_MAX_TASK_IDLE_MS = 5000;
    private static final int DEFAULT_PRODUCER_BATCH_SIZE_BYTES = 16384;
    private static final int DEFAULT_PRODUCER_LINGER_MS = 10;
    private static final int DEFAULT_PRODUCER_BUFFER_MEMORY_BYTES = 33554432;

    /**
     * Bootstrap servers for Kafka Streams.
     * Tenant deployments set {@code spring.oss-tenant.kafka.bootstrap-servers};
     * shared/SaaS deployments set {@code spring.saas.kafka.bootstrap-servers}.
     * {@code openframe.stream.kafka-streams.bootstrap-servers} overrides both — needed when a
     * deployment has BOTH clusters configured but the streams topology must run against a
     * specific one (e.g. the shared cluster's Fleet activity join reads the Debezium raw topics
     * on the shared Kafka while {@code spring.oss-tenant.kafka} points at the tenant cluster).
     */
    @Value("${openframe.stream.kafka-streams.bootstrap-servers:${spring.oss-tenant.kafka.bootstrap-servers:${spring.saas.kafka.bootstrap-servers:}}}")
    private String bootstrapServers;

    @Value("${spring.application.name}")
    private String applicationName;

    /**
     * Tenant/cluster identifier used to namespace Kafka Streams application.id.
     * In SaaS deployments this is typically set to TENANT_ID (e.g. tenant-y0-1).
     */
    @Value("${openframe.cluster-id:}")
    private String clusterId;

    private final ObjectMapper objectMapper;
    private final KafkaStreamsProperties kafkaStreamsProperties;

    public KafkaStreamsConfig(ObjectMapper objectMapper, KafkaStreamsProperties kafkaStreamsProperties) {
        this.objectMapper = objectMapper;
        this.kafkaStreamsProperties = kafkaStreamsProperties;
    }

    /**
     * Serde for ActivityMessage (DebeziumMessage<Activity>)
     */
    @Bean
    public Serde<ActivityMessage> activityMessageSerde() {
        return Serdes.serdeFrom(
            new JsonSerializer<>(objectMapper),
            new JsonDeserializer<>(ActivityMessage.class, objectMapper)
        );
    }

    /**
     * Serde for HostActivityMessage (DebeziumMessage<HostActivity>)
     */
    @Bean
    public Serde<HostActivityMessage> hostActivityMessageSerde() {
        return Serdes.serdeFrom(
            new JsonSerializer<>(objectMapper),
            new JsonDeserializer<>(HostActivityMessage.class, objectMapper)
        );
    }

    @Bean
    public Serde<ActivityMessage> outgoingActivityMessageSerde() {
        JsonSerde<ActivityMessage> serde = new JsonSerde<>(ActivityMessage.class);
        serde.serializer().setAddTypeInfo(false);
        return serde;
    }

    @Bean(name = KafkaStreamsDefaultConfiguration.DEFAULT_STREAMS_CONFIG_BEAN_NAME)
    public KafkaStreamsConfiguration kStreamsConfig() {
        Map<String, Object> props = new HashMap<>();
        String applicationId = buildStreamsApplicationId();

        // Basic Kafka Streams configuration
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, applicationId);
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        
        // Serialization configuration - using String for keys, custom Serde for values
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.AT_LEAST_ONCE);
        props.put(StreamsConfig.NUM_STREAM_THREADS_CONFIG, kafkaStreamsProperties.getNumStreamThreads(DEFAULT_NUM_STREAM_THREADS));
        
        // State store configuration - namespaced per application id to avoid collisions
        // between multiple Kafka Streams applications sharing the same pod filesystem
        props.put(StreamsConfig.STATE_DIR_CONFIG, kafkaStreamsProperties.getStateDir(DEFAULT_STATE_DIR_BASE) + "/" + applicationId);
        
        // Consumer configuration
        props.put(StreamsConfig.consumerPrefix(org.apache.kafka.clients.consumer.ConsumerConfig.AUTO_OFFSET_RESET_CONFIG), "earliest");
        props.put(StreamsConfig.consumerPrefix(org.apache.kafka.clients.consumer.ConsumerConfig.MAX_POLL_RECORDS_CONFIG), kafkaStreamsProperties.getMaxPollRecords(DEFAULT_MAX_POLL_RECORDS));

        // Allow stream-time to advance when some partitions have no data
        // This ensures leftJoin windows close even when host-activities topic is empty
        props.put(StreamsConfig.MAX_TASK_IDLE_MS_CONFIG, kafkaStreamsProperties.getMaxTaskIdleMs(DEFAULT_MAX_TASK_IDLE_MS));
        
        // Producer configuration
        props.put(StreamsConfig.producerPrefix(org.apache.kafka.clients.producer.ProducerConfig.BATCH_SIZE_CONFIG), kafkaStreamsProperties.getProducerBatchSizeBytes(DEFAULT_PRODUCER_BATCH_SIZE_BYTES));
        props.put(StreamsConfig.producerPrefix(org.apache.kafka.clients.producer.ProducerConfig.LINGER_MS_CONFIG), kafkaStreamsProperties.getProducerLingerMs(DEFAULT_PRODUCER_LINGER_MS));
        props.put(StreamsConfig.producerPrefix(org.apache.kafka.clients.producer.ProducerConfig.BUFFER_MEMORY_CONFIG), kafkaStreamsProperties.getProducerBufferMemoryBytes(DEFAULT_PRODUCER_BUFFER_MEMORY_BYTES));
        
        return new KafkaStreamsConfiguration(props);
    }

    private String buildStreamsApplicationId() {
        if (clusterId == null) {
            return applicationName;
        }
        String trimmed = clusterId.trim();
        if (trimmed.isEmpty()) {
            return applicationName;
        }
        return applicationName + "-" + trimmed;
    }

    /**
     * Externalized Kafka Streams tuning properties, bindable from
     * {@code openframe.stream.kafka-streams.*}. Each value is nullable so that
     * hardcoded defaults in {@link KafkaStreamsConfig} apply when not overridden.
     */
    @Configuration
    @ConfigurationProperties(prefix = "openframe.stream.kafka-streams")
    public static class KafkaStreamsProperties {

        private Integer numStreamThreads;
        private String stateDir;
        private Integer maxPollRecords;
        private Integer maxTaskIdleMs;
        private Integer producerBatchSizeBytes;
        private Integer producerLingerMs;
        private Integer producerBufferMemoryBytes;

        public int getNumStreamThreads(int defaultValue) {
            return numStreamThreads != null ? numStreamThreads : defaultValue;
        }

        public void setNumStreamThreads(Integer numStreamThreads) {
            this.numStreamThreads = numStreamThreads;
        }

        public String getStateDir(String defaultValue) {
            return stateDir != null && !stateDir.isBlank() ? stateDir : defaultValue;
        }

        public void setStateDir(String stateDir) {
            this.stateDir = stateDir;
        }

        public int getMaxPollRecords(int defaultValue) {
            return maxPollRecords != null ? maxPollRecords : defaultValue;
        }

        public void setMaxPollRecords(Integer maxPollRecords) {
            this.maxPollRecords = maxPollRecords;
        }

        public int getMaxTaskIdleMs(int defaultValue) {
            return maxTaskIdleMs != null ? maxTaskIdleMs : defaultValue;
        }

        public void setMaxTaskIdleMs(Integer maxTaskIdleMs) {
            this.maxTaskIdleMs = maxTaskIdleMs;
        }

        public int getProducerBatchSizeBytes(int defaultValue) {
            return producerBatchSizeBytes != null ? producerBatchSizeBytes : defaultValue;
        }

        public void setProducerBatchSizeBytes(Integer producerBatchSizeBytes) {
            this.producerBatchSizeBytes = producerBatchSizeBytes;
        }

        public int getProducerLingerMs(int defaultValue) {
            return producerLingerMs != null ? producerLingerMs : defaultValue;
        }

        public void setProducerLingerMs(Integer producerLingerMs) {
            this.producerLingerMs = producerLingerMs;
        }

        public int getProducerBufferMemoryBytes(int defaultValue) {
            return producerBufferMemoryBytes != null ? producerBufferMemoryBytes : defaultValue;
        }

        public void setProducerBufferMemoryBytes(Integer producerBufferMemoryBytes) {
            this.producerBufferMemoryBytes = producerBufferMemoryBytes;
        }
    }
} 
