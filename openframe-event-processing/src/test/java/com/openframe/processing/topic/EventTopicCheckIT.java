package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.EventsProperties;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// A real broker: the check finds what management created, stops on what is missing, and creates nothing itself.
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class EventTopicCheckIT {

    private static final String ORGANIZATIONS = "organizations";
    private static final String DEAD_LETTER_SUFFIX = "-dlt";
    private static final String COMPACT = "compact";
    private static final String DELETE = "delete";
    private static final short ONE_REPLICA = 1;

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer(DockerImageName.parse("apache/kafka:4.0.0"));

    private static AdminClient admin;

    @BeforeAll
    static void connect() {
        Map<String, Object> adminProperties = Map.of(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
        admin = AdminClient.create(adminProperties);
    }

    @AfterAll
    static void disconnect() {
        admin.close();
    }

    @Test
    void topicsManagementCreated_letTheServiceStart() throws Exception {
        // setup
        String prefix = newPrefix();
        createTopics(prefix, COMPACT);

        // execution
        check(prefix).afterSingletonsInstantiated();

        // verifications
        Set<String> topics = topicNames();
        assertThat(topics).contains(prefix + ORGANIZATIONS, prefix + ORGANIZATIONS + DEAD_LETTER_SUFFIX);
    }

    @Test
    void aMissingTopic_stopsTheService_andIsNotCreated() throws Exception {
        // setup
        String prefix = newPrefix();
        EventTopicCheck check = check(prefix);

        // execution and verifications
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(prefix + ORGANIZATIONS)
                .hasMessageContaining(prefix + ORGANIZATIONS + DEAD_LETTER_SUFFIX)
                .hasMessageContaining("EventTopicCatalog");
        Set<String> topics = topicNames();
        assertThat(topics).doesNotContain(prefix + ORGANIZATIONS, prefix + ORGANIZATIONS + DEAD_LETTER_SUFFIX);
    }

    @Test
    void aTopicThatIsNotCompacted_logsAWarn(CapturedOutput output) throws Exception {
        // setup
        String prefix = newPrefix();
        createTopics(prefix, DELETE);

        // execution
        check(prefix).afterSingletonsInstantiated();

        // verifications
        assertThat(output).contains("Event topic " + prefix + ORGANIZATIONS + " exists with cleanup.policy=delete");
    }

    @Test
    void aTypeSwitchedOff_needsNoTopic() {
        // setup
        String prefix = newPrefix();
        EventsProperties events = new EventsProperties();
        PublishedAggregateTopics nothingPublished = new PublishedAggregateTopics(events);

        // execution and verifications
        check(prefix, nothingPublished).afterSingletonsInstantiated();
    }

    private static void createTopics(String prefix, String eventsCleanupPolicy) throws Exception {
        Map<String, String> eventsConfig = Map.of("cleanup.policy", eventsCleanupPolicy);
        NewTopic events = new NewTopic(prefix + ORGANIZATIONS, 1, ONE_REPLICA).configs(eventsConfig);
        NewTopic deadLetter = new NewTopic(prefix + ORGANIZATIONS + DEAD_LETTER_SUFFIX, 1, ONE_REPLICA);
        List<NewTopic> topics = List.of(events, deadLetter);
        admin.createTopics(topics).all().get(30, TimeUnit.SECONDS);
    }

    private static EventTopicCheck check(String prefix) {
        EventsProperties events = new EventsProperties();
        events.setEnabled(true);
        EventsProperties.Topic organizations = new EventsProperties.Topic();
        organizations.setEnabled(true);
        events.getTopics().put(ORGANIZATIONS, organizations);
        PublishedAggregateTopics organizationsPublished = new PublishedAggregateTopics(events);
        return check(prefix, organizationsPublished);
    }

    private static EventTopicCheck check(String prefix, PublishedAggregateTopics publishedTopics) {
        EventProcessingKafkaProperties properties = new EventProcessingKafkaProperties();
        EventProcessingKafkaProperties.Kafka kafka = properties.getKafka();
        List<String> bootstrapServers = List.of(KAFKA.getBootstrapServers());
        kafka.setBootstrapServers(bootstrapServers);
        kafka.setTopicPrefix(prefix);
        AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
        RecordingProjection projection = new RecordingProjection("widget-on-organizations");
        WidgetSpec spec = new WidgetSpec(List.of(projection));
        List<AggregateSpec<?, ?>> specs = List.of(spec);
        when(specRegistry.specs()).thenReturn(specs);
        return new EventTopicCheck(specRegistry, publishedTopics, properties);
    }

    private static Set<String> topicNames() throws Exception {
        return admin.listTopics().names().get(30, TimeUnit.SECONDS);
    }

    private static String newPrefix() {
        return "it-" + UUID.randomUUID() + ".";
    }
}
