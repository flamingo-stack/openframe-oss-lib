package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.EventProcessingKafkaProperties.TopicSettings;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.CreateTopicsResult;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.errors.TopicExistsException;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

// Creates the missing topic and DLT of each type whose publish switch is on, before the listeners; never changes one.
// A plain AdminClient, not NewTopic beans: every KafkaAdmin in the context (Spring Boot's, the stream's saasKafkaAdmin) would create those too.
@Slf4j
@RequiredArgsConstructor
public class EventTopicCreator implements SmartInitializingSingleton {

    private static final long TIMEOUT_SECONDS = 30;
    private static final String CLEANUP_POLICY = "cleanup.policy";
    private static final String COMPACT = "compact";

    private final AggregateSpecRegistry specRegistry;
    private final PublishedAggregateTopics publishedTopics;
    private final EventProcessingKafkaProperties properties;

    @Override
    public void afterSingletonsInstantiated() {
        EventProcessingKafkaProperties.Kafka kafka = properties.getKafka();
        List<String> bootstrapServers = kafka.getBootstrapServers();
        if (bootstrapServers.isEmpty()) {
            throw new IllegalStateException("openframe.events.processing.kafka.bootstrap-servers is required when openframe.events.enabled is on");
        }
        String topicPrefix = EventTopicNames.requireTopicPrefix(kafka);
        Map<String, Object> adminProperties = kafka.buildAdminProperties();
        try (AdminClient admin = AdminClient.create(adminProperties)) {
            createMissing(admin, kafka.getTopics(), topicPrefix);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while creating the event topics on " + bootstrapServers, interrupted);
        } catch (ExecutionException | TimeoutException failure) {
            throw new IllegalStateException("Could not create the event topics on " + bootstrapServers, failure);
        }
    }

    private void createMissing(AdminClient admin, EventProcessingKafkaProperties.Topics topics, String topicPrefix)
            throws InterruptedException, ExecutionException, TimeoutException {
        Set<String> existing = admin.listTopics().names().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        List<NewTopic> missing = new ArrayList<>();
        List<String> existingEventTopics = new ArrayList<>();
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            String typeName = spec.getType();
            if (!publishedTopics.isPublishing(typeName)) {
                log.info("No event topic for {}: openframe.events.topics.{}.publish is off", typeName, typeName);
                continue;
            }
            String topic = EventTopicNames.topicOf(topicPrefix, typeName);
            String deadLetterTopic = EventTopicNames.deadLetterTopicOf(topic);
            if (existing.contains(topic)) {
                existingEventTopics.add(topic);
            } else {
                NewTopic eventsTopic = newTopic(topic, topics.getEvents());
                missing.add(eventsTopic);
            }
            if (!existing.contains(deadLetterTopic)) {
                NewTopic deadLetter = newTopic(deadLetterTopic, topics.getDeadLetter());
                missing.add(deadLetter);
            }
        }
        create(admin, missing);
        warnIfNotCompacted(admin, existingEventTopics);
    }

    // Another pod may create the same topic at the same moment; its TopicExistsException counts as success.
    private static void create(AdminClient admin, List<NewTopic> missing)
            throws InterruptedException, ExecutionException, TimeoutException {
        if (missing.isEmpty()) {
            return;
        }
        CreateTopicsResult result = admin.createTopics(missing);
        for (Map.Entry<String, KafkaFuture<Void>> created : result.values().entrySet()) {
            String topic = created.getKey();
            try {
                created.getValue().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                log.info("Created the event topic {}", topic);
            } catch (ExecutionException failure) {
                if (!(failure.getCause() instanceof TopicExistsException)) {
                    throw failure;
                }
                log.info("Event topic {} was created meanwhile by another pod", topic);
            }
        }
    }

    // A topic the broker auto-created before this ran has the delete policy, so a new group would miss old aggregates.
    private static void warnIfNotCompacted(AdminClient admin, List<String> eventTopics)
            throws InterruptedException, ExecutionException, TimeoutException {
        if (eventTopics.isEmpty()) {
            return;
        }
        List<ConfigResource> resources = eventTopics.stream()
                .map(topic -> new ConfigResource(ConfigResource.Type.TOPIC, topic))
                .toList();
        Map<ConfigResource, Config> configs = admin.describeConfigs(resources).all().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        configs.forEach((resource, config) -> {
            ConfigEntry cleanupPolicy = config.get(CLEANUP_POLICY);
            String policy = cleanupPolicy == null ? null : cleanupPolicy.value();
            if (policy == null || !policy.contains(COMPACT)) {
                log.warn("Event topic {} exists with cleanup.policy={}, not compact: a new consumer group would not see "
                        + "the latest event of every aggregate; fix the topic by hand", resource.name(), policy);
            }
        });
    }

    private static NewTopic newTopic(String name, TopicSettings settings) {
        int partitions = settings.getPartitions();
        short replicationFactor = settings.getReplicationFactor();
        Map<String, String> config = settings.getConfig();
        return new NewTopic(name, partitions, replicationFactor).configs(config);
    }
}
