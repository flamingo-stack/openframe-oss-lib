package com.openframe.processing.listener;

import com.openframe.data.repository.organization.publishing.OrganizationEvent;
import com.openframe.processing.config.EventProcessingKafkaAutoConfiguration;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

// What a record does in the listener, without a broker.
class ProjectionListenerTest {

    private static final String ORGANIZATIONS = "organizations";

    private final ProjectionRunner runner = mock(ProjectionRunner.class);
    private final Projection<?, ?> projection = mock(Projection.class);
    private final JsonMapper envelopeMapper = EventProcessingKafkaAutoConfiguration.buildEnvelopeMapper();
    private final ProjectionListener listener = new ProjectionListener(ORGANIZATIONS, projection, OrganizationEvent.class,
            envelopeMapper, runner);

    @Test
    void anEnvelope_isReadIntoTheSpecsEventClass_ignoringFieldsTheConsumerDoesNotKnow() {
        // setup
        ConsumerRecord<String, byte[]> record = record("""
                {"tenantId":"tenant-1","version":3,"deleted":false,"schemaVersion":1,
                 "event":{"organizationId":"org-1","name":"Acme","fieldFromANewerProducer":true}}
                """);

        // execution
        listener.onMessage(record);

        // verifications
        PublishedRecord<?> envelope = processedEnvelope();
        assertThat(envelope.getTenantId()).isEqualTo("tenant-1");
        assertThat(envelope.getVersion()).isEqualTo(3L);
        assertThat(envelope.getEvent()).isInstanceOfSatisfying(OrganizationEvent.class,
                event -> assertThat(event.getName()).isEqualTo("Acme"));
    }

    @Test
    void anEnumValueFromANewerProducer_isReadAsNull() {
        // setup
        ConsumerRecord<String, byte[]> record = record("""
                {"tenantId":"tenant-1","version":3,"deleted":false,"schemaVersion":1,
                 "event":{"organizationId":"org-1","name":"Acme","status":"STATUS_FROM_A_NEWER_PRODUCER"}}
                """);

        // execution
        listener.onMessage(record);

        // verifications
        assertThat(processedEnvelope().getEvent()).isInstanceOfSatisfying(OrganizationEvent.class,
                event -> assertThat(event.getStatus()).isNull());
    }

    @Test
    void aTombstone_isSkipped() {
        // setup
        ConsumerRecord<String, byte[]> tombstone = new ConsumerRecord<>("events.organizations", 0, 6L,
                "organization-document-1", null);

        // execution
        listener.onMessage(tombstone);

        // verifications
        verify(runner, never()).process(any(), any(), any(), any());
    }

    @Test
    void anUnreadableValue_throws_soTheErrorHandlerSendsItToTheDlt() {
        // setup
        ConsumerRecord<String, byte[]> record = record("not json");

        // execution and verifications
        assertThatThrownBy(() -> listener.onMessage(record)).isInstanceOf(JacksonException.class);
        verify(runner, never()).process(any(), any(), any(), any());
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private PublishedRecord<?> processedEnvelope() {
        ArgumentCaptor<PublishedRecord> envelope = ArgumentCaptor.forClass(PublishedRecord.class);
        verify(runner).process(eq(ORGANIZATIONS), eq(projection), eq("organization-document-1"), envelope.capture());
        return envelope.getValue();
    }

    private static ConsumerRecord<String, byte[]> record(String json) {
        byte[] value = json.getBytes(StandardCharsets.UTF_8);
        return new ConsumerRecord<>("events.organizations", 0, 5L, "organization-document-1", value);
    }
}
