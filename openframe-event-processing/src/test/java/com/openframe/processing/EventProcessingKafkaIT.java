package com.openframe.processing;

import com.openframe.data.repository.organization.publishing.OrganizationEvent;
import com.openframe.processing.api.EventProcessor;
import com.openframe.processing.config.EventProcessingAutoConfiguration;
import com.openframe.processing.config.EventProcessingKafkaAutoConfiguration;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

// A real broker: record -> listener -> runner -> processor, and the error handler's retry and DLT.
@SpringBootTest(classes = EventProcessingKafkaIT.TestApplication.class,
        properties = {"openframe.events.processing.enabled=true",
                "openframe.events.processing.kafka.topic-prefix=events.",
                "openframe.events.processing.kafka.group-prefix=processing-it.",
                "openframe.events.processing.processors." + EventProcessingKafkaIT.PROCESSOR + ".mode=events",
                "openframe.events.processing.kafka.back-off.initial-interval=100ms",
                "openframe.events.processing.kafka.back-off.max-interval=200ms"})
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class EventProcessingKafkaIT {

    static final String PROCESSOR = "widget-on-organizations";

    private static final String TOPIC = "events.organizations";
    private static final String DEAD_LETTER_TOPIC = "events.organizations-dlt";
    private static final String FAILING = "failing";
    private static final String MONGO_DOWN = "mongo-down";
    private static final String CONFLICT = "conflict";
    private static final Duration WAIT = Duration.ofSeconds(60);
    private static final Duration SECOND_COPY_WINDOW = Duration.ofSeconds(2);

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer(DockerImageName.parse("apache/kafka:4.0.0"));

    @DynamicPropertySource
    static void kafkaProperties(DynamicPropertyRegistry registry) {
        registry.add("openframe.events.processing.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
    }

    @BeforeAll
    static void createTopics() throws Exception {
        Map<String, Object> adminProperties = Map.of(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
        try (AdminClient admin = AdminClient.create(adminProperties)) {
            NewTopic topic = new NewTopic(TOPIC, 1, (short) 1);
            NewTopic deadLetterTopic = new NewTopic(DEAD_LETTER_TOPIC, 1, (short) 1);
            List<NewTopic> topics = List.of(topic, deadLetterTopic);
            admin.createTopics(topics).all().get(30, TimeUnit.SECONDS);
        }
    }

    @Autowired @Qualifier("eventProcessingKafkaTemplate") private KafkaTemplate<String, byte[]> eventProcessingKafkaTemplate;
    @Autowired private RecordingProcessor processor;

    @Test
    void anEnvelope_reachesTheProcessor_withItsEventAndVersion() throws Exception {
        String organizationId = newOrganizationId();
        String aggregateId = newAggregateId();
        byte[] value = envelope(organizationId, "Acme", 3);

        send(aggregateId, value);

        await().atMost(WAIT).until(() -> processor.applied.containsKey(organizationId));
        assertThat(processor.applied.get(organizationId)).singleElement().satisfies(record -> {
            assertThat(record.getVersion()).isEqualTo(3L);
            assertThat(record.getTenantId()).isEqualTo("tenant-1");
            assertThat(record.getEvent().getName()).isEqualTo("Acme");
        });
    }

    @Test
    void aProcessorsFailure_goesToTheDlt_once_withTheRecordUnchanged() throws Exception {
        String organizationId = newOrganizationId();
        String aggregateId = newAggregateId();
        byte[] value = envelope(organizationId, FAILING, 1);

        send(aggregateId, value);

        ConsumerRecord<String, byte[]> deadLetter = deadLetterOf(aggregateId);
        assertThat(deadLetter.value()).isEqualTo(value);
        assertThat(headerOf(deadLetter, KafkaHeaders.DLT_EXCEPTION_MESSAGE)).contains(PROCESSOR);
        assertThat(processor.attempts.get(organizationId)).hasValue(1);
    }

    @Test
    void aWriteConflict_goesToTheDlt_once_insteadOfBlockingThePartition() throws Exception {
        String organizationId = newOrganizationId();
        String aggregateId = newAggregateId();
        byte[] value = envelope(organizationId, CONFLICT, 1);

        send(aggregateId, value);

        ConsumerRecord<String, byte[]> deadLetter = deadLetterOf(aggregateId);
        assertThat(deadLetter.value()).isEqualTo(value);
        assertThat(processor.attempts.get(organizationId)).hasValue(1);
    }

    @Test
    void anEnumValueFromANewerProducer_reachesTheProcessorAsNull_insteadOfTheDlt() throws Exception {
        String organizationId = newOrganizationId();
        String aggregateId = newAggregateId();
        String json = """
                {"tenantId":"tenant-1","version":1,"deleted":false,"schemaVersion":1,
                 "event":{"organizationId":"%s","name":"Acme","status":"STATUS_FROM_A_NEWER_PRODUCER"}}
                """.formatted(organizationId);
        byte[] value = json.getBytes(StandardCharsets.UTF_8);

        send(aggregateId, value);

        await().atMost(WAIT).until(() -> processor.applied.containsKey(organizationId));
        assertThat(processor.applied.get(organizationId)).singleElement()
                .satisfies(record -> assertThat(record.getEvent().getStatus()).isNull());
    }

    @Test
    void anUnreadableValue_goesToTheDlt_withoutReachingAProcessor_andIsLogged(CapturedOutput output) throws Exception {
        String aggregateId = newAggregateId();
        byte[] value = "not json".getBytes(StandardCharsets.UTF_8);

        send(aggregateId, value);

        ConsumerRecord<String, byte[]> deadLetter = deadLetterOf(aggregateId);
        assertThat(deadLetter.value()).isEqualTo(value);
        assertThat(headerOf(deadLetter, KafkaHeaders.DLT_EXCEPTION_STACKTRACE)).contains("ConversionException");
        assertThat(output).contains("Record " + aggregateId + " of " + TOPIC).contains("goes to " + DEAD_LETTER_TOPIC);
    }

    @Test
    void mongoDown_isRetried_untilTheProcessorSucceeds() throws Exception {
        String organizationId = newOrganizationId();
        String aggregateId = newAggregateId();
        byte[] value = envelope(organizationId, MONGO_DOWN, 1);

        send(aggregateId, value);

        await().atMost(WAIT).until(() -> processor.applied.containsKey(organizationId));
        assertThat(processor.attempts.get(organizationId)).hasValue(RecordingProcessor.MONGO_DOWN_ATTEMPTS + 1);
    }

    private void send(String key, byte[] value) throws Exception {
        eventProcessingKafkaTemplate.send(TOPIC, key, value).get(30, TimeUnit.SECONDS);
    }

    private static ConsumerRecord<String, byte[]> deadLetterOf(String key) {
        String group = "dead-letters-" + UUID.randomUUID();
        Map<String, Object> consumerProperties = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ConsumerConfig.GROUP_ID_CONFIG, group,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
        List<ConsumerRecord<String, byte[]>> found = new CopyOnWriteArrayList<>();
        try (KafkaConsumer<String, byte[]> consumer = new KafkaConsumer<>(consumerProperties)) {
            List<String> topics = List.of(DEAD_LETTER_TOPIC);
            consumer.subscribe(topics);
            await().atMost(WAIT).pollInSameThread().until(() -> {
                ConsumerRecords<String, byte[]> records = consumer.poll(Duration.ofMillis(500));
                records.forEach(record -> keepIfKeyMatches(record, key, found));
                return !found.isEmpty();
            });
            // Keep reading a little, so a second copy of the same record would be seen.
            long readUntil = System.currentTimeMillis() + SECOND_COPY_WINDOW.toMillis();
            while (System.currentTimeMillis() < readUntil) {
                ConsumerRecords<String, byte[]> records = consumer.poll(Duration.ofMillis(200));
                records.forEach(record -> keepIfKeyMatches(record, key, found));
            }
        }
        assertThat(found).hasSize(1);
        return found.getFirst();
    }

    private static void keepIfKeyMatches(ConsumerRecord<String, byte[]> record, String key,
                                         List<ConsumerRecord<String, byte[]>> found) {
        if (key.equals(record.key())) {
            found.add(record);
        }
    }

    private static String headerOf(ConsumerRecord<String, byte[]> record, String name) {
        Header header = record.headers().lastHeader(name);
        return new String(header.value(), StandardCharsets.UTF_8);
    }

    // The Kafka key is the document's Mongo _id, which differs from the organizationId inside the event.
    private static String newAggregateId() {
        return "organization-document-" + UUID.randomUUID();
    }

    private static String newOrganizationId() {
        return "org-" + UUID.randomUUID();
    }

    private static byte[] envelope(String organizationId, String name, long version) {
        String json = """
                {"tenantId":"tenant-1","version":%d,"deleted":false,"schemaVersion":1,
                 "event":{"organizationId":"%s","name":"%s"}}
                """.formatted(version, organizationId, name);
        return json.getBytes(StandardCharsets.UTF_8);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({PropertyPlaceholderAutoConfiguration.class, KafkaAutoConfiguration.class,
            EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class})
    static class TestApplication {

        @Bean
        MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }

        @Bean
        RecordingProcessor recordingProcessor() {
            return new RecordingProcessor();
        }
    }

    // Fails on the name FAILING, conflicts on CONFLICT; on MONGO_DOWN, throws Mongo down for its first attempts, then applies.
    static class RecordingProcessor implements EventProcessor<OrganizationEvent> {

        static final int MONGO_DOWN_ATTEMPTS = 2;

        final Map<String, List<PublishedRecord<OrganizationEvent>>> applied = new ConcurrentHashMap<>();
        final Map<String, AtomicInteger> attempts = new ConcurrentHashMap<>();

        @Override
        public String name() {
            return PROCESSOR;
        }

        @Override
        public PublishedAggregateType getType() {
            return PublishedAggregateType.ORGANIZATIONS;
        }

        @Override
        public long process(PublishedRecord<OrganizationEvent> record) {
            OrganizationEvent event = record.getEvent();
            String organizationId = event.getOrganizationId();
            int attempt = attempts.computeIfAbsent(organizationId, id -> new AtomicInteger()).incrementAndGet();
            if (FAILING.equals(event.getName())) {
                throw new IllegalStateException("Widget write failed");
            }
            if (CONFLICT.equals(event.getName())) {
                throw new OptimisticLockingFailureException("Write conflict");
            }
            if (MONGO_DOWN.equals(event.getName()) && attempt <= MONGO_DOWN_ATTEMPTS) {
                throw new DataAccessResourceFailureException("Mongo down");
            }
            applied.computeIfAbsent(organizationId, id -> new CopyOnWriteArrayList<>()).add(record);
            return 1;
        }
    }
}
