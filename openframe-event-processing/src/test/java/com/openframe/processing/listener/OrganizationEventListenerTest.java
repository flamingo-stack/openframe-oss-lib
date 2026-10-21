package com.openframe.processing.listener;

import com.openframe.data.repository.organization.publishing.OrganizationEvent;
import com.openframe.processing.runner.EventProcessorRunner;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedRecord;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

// What a record does in the listener, without a broker.
class OrganizationEventListenerTest {

    private static final PublishedAggregateType ORGANIZATIONS = PublishedAggregateType.ORGANIZATIONS;

    private final EventProcessorRunner runner = mock(EventProcessorRunner.class);
    private final OrganizationEventListener listener = new OrganizationEventListener(runner);

    @Test
    void anEnvelope_goesToTheRunner() {
        PublishedRecord<OrganizationEvent> envelope = envelope();

        listener.onOrganization("organization-document-1", envelope);

        verify(runner).process(eq(ORGANIZATIONS), eq("organization-document-1"), same(envelope));
    }

    @Test
    void aTombstone_isSkipped() {
        listener.onOrganization("organization-document-1", null);

        verify(runner, never()).process(any(), any(), any());
    }

    private static PublishedRecord<OrganizationEvent> envelope() {
        OrganizationEvent event = OrganizationEvent.builder().organizationId("org-1").name("Acme").build();
        return PublishedRecord.<OrganizationEvent>builder().tenantId("tenant-1").version(3L).event(event).build();
    }
}
