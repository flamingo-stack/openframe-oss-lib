package com.openframe.kafka.config;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import jakarta.annotation.PostConstruct;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.NewTopic;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class KafkaTopicInitializer {

    private final OssTenantKafkaProperties ossTenantKafkaProperties;
    private final KafkaTopicProperties kafkaTopicProperties;

    public KafkaTopicInitializer(OssTenantKafkaProperties ossTenantKafkaProperties,
                                  KafkaTopicProperties kafkaTopicProperties) {
        this.ossTenantKafkaProperties = ossTenantKafkaProperties;
        this.kafkaTopicProperties = kafkaTopicProperties;
    }

    private int getMaxRetries() {
        return kafkaTopicProperties.getRetry().getMaxAttempts();
    }

    private long getRetryDelayMs() {
        return kafkaTopicProperties.getRetry().getDelayMs();
    }

    private int getTimeoutSeconds() {
        return kafkaTopicProperties.getTimeoutSeconds();
    }

    @PostConstruct
    public void init() {
        if (!kafkaTopicProperties.isAutoCreate()) {
            log.info("Kafka topic auto-creation is disabled");
            return;
        }

        Map<String, KafkaTopicProperties.TopicConfig> inboundTopics = kafkaTopicProperties.getInbound();
        if (inboundTopics == null || inboundTopics.isEmpty()) {
            log.info("No Kafka topics configured for auto-creation");
            return;
        }

        log.info("Starting Kafka topic initialization with {} topics", inboundTopics.size());
        createTopicsWithRetry(inboundTopics);
        log.info("Kafka topic initialization completed");
    }

    private void createTopicsWithRetry(Map<String, KafkaTopicProperties.TopicConfig> topics) {
        int attempt = 0;
        Exception lastException = null;
        int maxRetries = getMaxRetries();
        long retryDelayMs = getRetryDelayMs();

        while (attempt < maxRetries) {
            try {
                createTopics(topics);
                return;
            } catch (Exception e) {
                lastException = e;
                attempt++;

                if (attempt >= maxRetries) {
                    log.error("Failed to create Kafka topics after {} attempts", maxRetries, e);
                    throw new RuntimeException("Failed to create Kafka topics after " + maxRetries + " attempts", e);
                }

                log.warn("Failed to create Kafka topics, retrying in {} ms (attempt {}/{}): {}",
                        retryDelayMs, attempt, maxRetries, e.getMessage());

                try {
                    TimeUnit.MILLISECONDS.sleep(retryDelayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting to retry topic creation", ie);
                }
            }
        }

        if (lastException != null) {
            throw new RuntimeException("Failed to create Kafka topics", lastException);
        }
    }

    private void createTopics(Map<String, KafkaTopicProperties.TopicConfig> topics) {
        var adminProps = ossTenantKafkaProperties.getKafka().buildAdminProperties(null);
        int timeout = getTimeoutSeconds();

        try (AdminClient adminClient = AdminClient.create(adminProps)) {
            Set<String> existingTopics = getExistingTopics(adminClient, timeout);
            List<NewTopic> topicsToCreate = new ArrayList<>();

            for (Map.Entry<String, KafkaTopicProperties.TopicConfig> entry : topics.entrySet()) {
                KafkaTopicProperties.TopicConfig config = entry.getValue();
                String topicName = config.getName();

                if (topicName == null || topicName.isBlank()) {
                    log.warn("Topic configuration '{}' has no name, skipping", entry.getKey());
                    continue;
                }

                if (existingTopics.contains(topicName)) {
                    log.info("Topic '{}' already exists, skipping creation", topicName);
                    continue;
                }

                NewTopic newTopic = new NewTopic(topicName, config.getPartitions(), config.getReplicationFactor());
                topicsToCreate.add(newTopic);
                log.info("Preparing to create topic '{}' with {} partitions and replication factor {}",
                        topicName, config.getPartitions(), config.getReplicationFactor());
            }

            if (topicsToCreate.isEmpty()) {
                log.info("No new topics to create");
                return;
            }

            var createResult = adminClient.createTopics(topicsToCreate);
            createResult.all().get(timeout, TimeUnit.SECONDS);

            for (NewTopic topic : topicsToCreate) {
                log.info("Successfully created topic '{}'", topic.name());
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while creating Kafka topics", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new RuntimeException("Failed to create Kafka topics", e);
        }
    }

    private Set<String> getExistingTopics(AdminClient adminClient, int timeout) {
        try {
            return adminClient.listTopics().names().get(timeout, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while listing Kafka topics", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new RuntimeException("Failed to list Kafka topics", e);
        }
    }
}
