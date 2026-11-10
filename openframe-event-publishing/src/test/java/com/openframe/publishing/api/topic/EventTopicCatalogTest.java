package com.openframe.publishing.api.topic;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EventTopicCatalogTest {

    private static final String PREFIX = "dev.events.";

    private final AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
    private final EventTopicCatalog catalog = new EventTopicCatalog(specRegistry);

    @Test
    void everyType_getsItsTopicAndItsDlt_inTypeOrder() {
        // setup
        Set<String> types = Set.of("users", "organizations");
        when(specRegistry.types()).thenReturn(types);

        // execution
        List<EventTopicDefinition> topics = catalog.findAllTopics(PREFIX);

        // verifications
        assertThat(topics).extracting(EventTopicDefinition::getName).containsExactly(
                "dev.events.organizations", "dev.events.organizations-dlt", "dev.events.users", "dev.events.users-dlt");
        assertThat(topics).extracting(EventTopicDefinition::getPartitions).containsOnly(1);
    }

    @Test
    void theEventsTopic_isCompacted_andKeepsADeleteFor7Days() {
        // setup
        Set<String> types = Set.of("organizations");
        when(specRegistry.types()).thenReturn(types);

        // execution
        EventTopicDefinition events = catalog.findAllTopics(PREFIX).getFirst();

        // verifications
        assertThat(events.getConfig()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "cleanup.policy", "compact",
                "min.compaction.lag.ms", "604800000",
                "delete.retention.ms", "604800000"));
    }

    @Test
    void theDlt_keepsItsRecordsFor30Days() {
        // setup
        Set<String> types = Set.of("organizations");
        when(specRegistry.types()).thenReturn(types);

        // execution
        EventTopicDefinition deadLetter = catalog.findAllTopics(PREFIX).getLast();

        // verifications
        assertThat(deadLetter.getConfig()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "cleanup.policy", "delete",
                "retention.ms", "2592000000"));
    }

    @Test
    void noSpec_meansNoTopic() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of());

        // execution
        List<EventTopicDefinition> topics = catalog.findAllTopics(PREFIX);

        // verifications
        assertThat(topics).isEmpty();
    }

    @Test
    void theNames_areThePrefixTheTypeAndTheDltSuffix() {
        // execution
        String topic = EventTopicCatalog.topicOf(PREFIX, "tickets");
        String deadLetter = EventTopicCatalog.deadLetterTopicOf(topic);

        // verifications
        assertThat(topic).isEqualTo("dev.events.tickets");
        assertThat(deadLetter).isEqualTo("dev.events.tickets-dlt");
    }
}
