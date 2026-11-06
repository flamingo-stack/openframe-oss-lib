package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CustomTicketRepositoryStampTest {

    private static final Instant ACTIVITY = Instant.parse("2026-01-01T00:05:00Z");
    private static final Document KEEP_VERSION = new Document("version", 0);

    private final TenantAwareMongoTemplate mongoTemplate = mock(TenantAwareMongoTemplate.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<OutboxPublisher> outboxPublisher = mock(ObjectProvider.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<TicketAggregateSpec> ticketSpec = mock(ObjectProvider.class);
    private final CustomTicketRepositoryImpl repository = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher,
            ticketSpec);

    @Test
    @DisplayName("Given a chat message, when the last activity is stamped, then the update increments the version by 0, so Spring adds no +1 and a user edit of the ticket does not conflict")
    void lastActivityStampKeepsVersion() {
        repository.updateLastActivityAt("ticket-1", ACTIVITY);

        assertThat(captureExecutedUpdate().get("$inc")).isEqualTo(KEEP_VERSION);
    }

    @Test
    @DisplayName("Given a client message, when activity and awaiting are stamped, then the update increments the version by 0")
    void activityAndAwaitingStampKeepsVersion() {
        repository.updateActivityAndAwaiting("ticket-1", ACTIVITY, ACTIVITY);

        assertThat(captureExecutedUpdate().get("$inc")).isEqualTo(KEEP_VERSION);
    }

    private Document captureExecutedUpdate() {
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).findAndModify(any(Query.class), update.capture(), any(FindAndModifyOptions.class), eq(Ticket.class));
        return update.getValue().getUpdateObject();
    }
}
