package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.common.config.ConfigResource;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Stream;

import static org.springframework.util.CollectionUtils.isEmpty;

// Only management creates topics (CU-86ah6xx4n); the stream checks the topic and DLT of each type switched on before its listeners start.
@Slf4j
@RequiredArgsConstructor
public class EventTopicCheck implements SmartInitializingSingleton {

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
        if (isEmpty(bootstrapServers)) {
            throw new IllegalStateException("openframe.events.processing.kafka.bootstrap-servers is required when openframe.events.enabled is on");
        }
        String topicPrefix = EventTopicNames.requireTopicPrefix(kafka);
        Map<String, Object> adminProperties = kafka.buildAdminProperties();
        try (AdminClient admin = AdminClient.create(adminProperties)) {
            checkTopics(admin, topicPrefix, bootstrapServers);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while checking the event topics on " + bootstrapServers, interrupted);
        } catch (ExecutionException | TimeoutException failure) {
            throw new IllegalStateException("Could not check the event topics on " + bootstrapServers, failure);
        }
    }

    private void checkTopics(AdminClient admin, String topicPrefix, List<String> bootstrapServers)
            throws InterruptedException, ExecutionException, TimeoutException {
        List<String> eventTopics = findPublishedEventTopics(topicPrefix);
        List<String> requiredTopics = eventTopics.stream()
                .flatMap(EventTopicCheck::withItsDeadLetterTopic)
                .toList();
        Set<String> existing = admin.listTopics().names().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        List<String> missing = requiredTopics.stream()
                .filter(topic -> !existing.contains(topic))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Event topics missing on " + bootstrapServers + ": " + missing
                    + "; management creates them from the specs (EventTopicCatalog) with openframe.saas.kafka.event-topics.enabled on, before the type is switched on here");
        }
        warnIfNotCompacted(admin, eventTopics);
        log.info("Event topics found: {}", requiredTopics);
    }

    private List<String> findPublishedEventTopics(String topicPrefix) {
        return specRegistry.specs().stream()
                .map(AggregateSpec::getType)
                .filter(publishedTopics::isPublishing)
                .map(typeName -> EventTopicNames.topicOf(topicPrefix, typeName))
                .toList();
    }

    private static Stream<String> withItsDeadLetterTopic(String topic) {
        String deadLetterTopic = EventTopicNames.deadLetterTopicOf(topic);
        return Stream.of(topic, deadLetterTopic);
    }

    // A topic created without the compact policy would make a new consumer group miss the latest event of old aggregates.
    private static void warnIfNotCompacted(AdminClient admin, List<String> eventTopics)
            throws InterruptedException, ExecutionException, TimeoutException {
        if (eventTopics.isEmpty()) {
            return;
        }
        List<ConfigResource> resources = eventTopics.stream()
                .map(topic -> new ConfigResource(ConfigResource.Type.TOPIC, topic))
                .toList();
        Map<ConfigResource, Config> configs = admin.describeConfigs(resources).all().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        configs.forEach(EventTopicCheck::warnIfNotCompacted);
    }

    private static void warnIfNotCompacted(ConfigResource resource, Config config) {
        ConfigEntry cleanupPolicy = config.get(CLEANUP_POLICY);
        String policy = cleanupPolicy == null ? null : cleanupPolicy.value();
        if (isNotCompacted(policy)) {
            log.warn("Event topic {} exists with cleanup.policy={}, not compact: a new consumer group would not see "
                    + "the latest event of every aggregate; fix the topic by hand", resource.name(), policy);
        }
    }

    private static boolean isNotCompacted(String policy) {
        return policy == null || !policy.contains(COMPACT);
    }
}
