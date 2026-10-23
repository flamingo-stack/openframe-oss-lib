package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.config.ConfigResource;
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
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// A real broker: what the creator makes, and what it leaves alone.
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class EventTopicCreatorIT {

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
    void theTopic_isCompacted_andItsDlt_keepsRecordsFor30Days() throws Exception {
        // setup
        String prefix = newPrefix();

        // execution
        creator(prefix).afterSingletonsInstantiated();

        // verifications
        Config topic = configOf(prefix + "organizations");
        assertThat(topic.get("cleanup.policy").value()).isEqualTo("compact");
        assertThat(topic.get("min.compaction.lag.ms").value()).isEqualTo("604800000");
        assertThat(topic.get("delete.retention.ms").value()).isEqualTo("604800000");
        Config deadLetter = configOf(prefix + "organizations-dlt");
        assertThat(deadLetter.get("cleanup.policy").value()).isEqualTo("delete");
        assertThat(deadLetter.get("retention.ms").value()).isEqualTo("2592000000");
    }

    @Test
    void anExistingTopic_isLeftAsItIs_withAWarnWhenItIsNotCompacted(CapturedOutput output) throws Exception {
        // setup
        String prefix = newPrefix();
        NewTopic autoCreated = new NewTopic(prefix + "organizations", 3, (short) 1);
        List<NewTopic> existing = List.of(autoCreated);
        admin.createTopics(existing).all().get(30, TimeUnit.SECONDS);

        // execution
        creator(prefix).afterSingletonsInstantiated();

        // verifications
        assertThat(partitionsOf(prefix + "organizations")).isEqualTo(3);
        assertThat(configOf(prefix + "organizations").get("cleanup.policy").value()).isEqualTo("delete");
        assertThat(partitionsOf(prefix + "organizations-dlt")).isEqualTo(1);
        assertThat(output).contains("Event topic " + prefix + "organizations exists with cleanup.policy=delete");
    }

    @Test
    void aSecondStart_findsEverythingThere_andStartsAsWell() {
        // setup
        String prefix = newPrefix();
        EventTopicCreator creator = creator(prefix);
        creator.afterSingletonsInstantiated();

        // execution and verifications
        creator.afterSingletonsInstantiated();
    }

    private static EventTopicCreator creator(String prefix) {
        EventProcessingKafkaProperties properties = new EventProcessingKafkaProperties();
        EventProcessingKafkaProperties.Kafka kafka = properties.getKafka();
        kafka.setBootstrapServers(List.of(KAFKA.getBootstrapServers()));
        kafka.setTopicPrefix(prefix);
        kafka.getTopics().getEvents().setReplicationFactor((short) 1);
        kafka.getTopics().getDeadLetter().setReplicationFactor((short) 1);
        AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
        WidgetSpec spec = new WidgetSpec(List.of(new RecordingProjection("widget-on-organizations")));
        List<AggregateSpec<?, ?>> specs = List.of(spec);
        when(specRegistry.specs()).thenReturn(specs);
        return new EventTopicCreator(specRegistry, properties);
    }

    private static Config configOf(String topic) throws Exception {
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, topic);
        List<ConfigResource> resources = List.of(resource);
        return admin.describeConfigs(resources).all().get(30, TimeUnit.SECONDS).get(resource);
    }

    private static int partitionsOf(String topic) throws Exception {
        List<String> topics = List.of(topic);
        TopicDescription description = admin.describeTopics(topics).allTopicNames().get(30, TimeUnit.SECONDS).get(topic);
        return description.partitions().size();
    }

    private static String newPrefix() {
        return "it-" + UUID.randomUUID() + ".";
    }
}
