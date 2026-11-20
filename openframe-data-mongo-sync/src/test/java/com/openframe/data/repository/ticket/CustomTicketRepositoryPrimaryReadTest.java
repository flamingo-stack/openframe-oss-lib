package com.openframe.data.repository.ticket;

import com.mongodb.ReadPreference;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomTicketRepositoryPrimaryReadTest {

    private static final String TENANT_ID = "tenant-primary-read";
    private static final String TICKET_ID = "ticket-1";
    private static final String TENANT_FIELD = "tenantId";
    private static final String ID_FIELD = "_id";

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Mock private ObjectProvider<OutboxPublisher> outboxPublisher;
    @Mock private ObjectProvider<TicketAggregateSpec> ticketSpec;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    private CustomTicketRepositoryImpl repository;
    private Ticket ticket;

    @BeforeEach
    void setUp() {
        repository = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher, ticketSpec);
        ticket = new Ticket();
        ticket.setId(TICKET_ID);
    }

    @Test
    void findByIdFromPrimary_existingTicket_tenantFencedPrimaryPointRead() {
        // setup
        stubTenant();
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(ticket);

        // execution
        Optional<Ticket> found = repository.findByIdFromPrimary(TICKET_ID);

        // verifications
        assertThat(found).containsSame(ticket);
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getReadPreference()).isEqualTo(ReadPreference.primary());
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry(TENANT_FIELD, TENANT_ID)
                .containsEntry(ID_FIELD, TICKET_ID);
    }

    @Test
    void findByIdFromPrimary_missingTicket_empty() {
        // setup
        stubTenant();

        // execution
        Optional<Ticket> found = repository.findByIdFromPrimary(TICKET_ID);

        // verifications
        assertThat(found).isEmpty();
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getReadPreference()).isEqualTo(ReadPreference.primary());
    }

    @Test
    void existsByIdFromPrimary_ticketOnPrimary_true() {
        // setup
        stubTenant();
        when(mongoTemplate.exists(any(Query.class), eq(Ticket.class))).thenReturn(true);

        // execution
        boolean exists = repository.existsByIdFromPrimary(TICKET_ID);

        // verifications
        assertThat(exists).isTrue();
        verify(mongoTemplate).exists(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getReadPreference()).isEqualTo(ReadPreference.primary());
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry(TENANT_FIELD, TENANT_ID)
                .containsEntry(ID_FIELD, TICKET_ID);
    }

    @Test
    void existsByIdFromPrimary_noTicketOnPrimary_false() {
        // setup
        stubTenant();

        // execution
        boolean exists = repository.existsByIdFromPrimary(TICKET_ID);

        // verifications
        assertThat(exists).isFalse();
        verify(mongoTemplate).exists(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getReadPreference()).isEqualTo(ReadPreference.primary());
    }

    private void stubTenant() {
        Criteria tenant = Criteria.where(TENANT_FIELD).is(TENANT_ID);
        when(mongoTemplate.tenantCriteria()).thenReturn(tenant);
    }
}
