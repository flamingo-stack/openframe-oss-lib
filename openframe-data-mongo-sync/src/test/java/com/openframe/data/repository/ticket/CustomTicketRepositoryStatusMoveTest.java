package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CustomTicketRepositoryStatusMoveTest {

    private final TenantAwareMongoTemplate mongoTemplate = mock(TenantAwareMongoTemplate.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<OutboxPublisher> outboxPublisher = mock(ObjectProvider.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<TicketAggregateSpec> ticketSpec = mock(ObjectProvider.class);
    private final CustomTicketRepositoryImpl repository = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher,
            ticketSpec);

    @Test
    void moveFromStatus_anyTicket_changesItOnlyWhileItIsStillInTheFromStatus() {
        repository.moveFromStatus("ticket-1", "st-resolved", "st-archived", TicketStatusKind.ARCHIVED);

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).findAndModify(query.capture(), any(Update.class), eq(Ticket.class));
        assertThat(query.getValue().getQueryObject())
                .containsEntry("_id", "ticket-1")
                .containsEntry("statusId", "st-resolved");
    }
}
