package com.openframe.data.repository.ticket;

import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.OptimisticLockingFailureException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomTicketRepositoryTitleTest {

    private final TenantAwareMongoTemplate mongoTemplate = mock(TenantAwareMongoTemplate.class);
    private final OutboxPublisher publisher = mock(OutboxPublisher.class);
    private final TicketAggregateSpec spec = mock(TicketAggregateSpec.class);
    private final CustomTicketRepositoryImpl repository = buildRepository();

    // The generated title arrives while the user may save the same ticket; a lost title would stay null for good.
    @Test
    void aTitleWriteThatMeetsAConcurrentSave_isWrittenOnceMore() {
        when(publisher.publishChanged(eq(spec), any()))
                .thenThrow(new OptimisticLockingFailureException("write conflict"))
                .thenReturn(null);

        repository.updateTitle("ticket-1", "Printer jam");

        verify(publisher, times(2)).publishChanged(eq(spec), any());
    }

    @Test
    void aSecondConflict_reachesTheCaller() {
        OptimisticLockingFailureException conflict = new OptimisticLockingFailureException("write conflict");
        when(publisher.publishChanged(eq(spec), any())).thenThrow(conflict);

        assertThatThrownBy(() -> repository.updateTitle("ticket-1", "Printer jam")).isSameAs(conflict);
    }

    @SuppressWarnings("unchecked")
    private CustomTicketRepositoryImpl buildRepository() {
        ObjectProvider<OutboxPublisher> outboxPublisher = mock(ObjectProvider.class);
        when(outboxPublisher.getIfAvailable()).thenReturn(publisher);
        ObjectProvider<TicketAggregateSpec> ticketSpec = mock(ObjectProvider.class);
        when(ticketSpec.getIfAvailable()).thenReturn(spec);
        return new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher, ticketSpec);
    }
}
