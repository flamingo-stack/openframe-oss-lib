package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.openframe.data.document.ticket.Ticket;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class CustomTicketRepositoryFilterTest {

    private static final String ESCALATED_BY_USER = "escalatedByUser";
    private static final String HAS_PENDING_APPROVAL = "hasPendingApproval";

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    private CustomTicketRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new CustomTicketRepositoryImpl(mongoTemplate);
    }

    @Test
    void buildTicketQuery_escalatedByUserTrue_onlyTicketsTheClientEscalated() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().escalatedByUser(true).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query).containsEntry(ESCALATED_BY_USER, true);
    }

    // Tickets escalated by inactivity carry no value at all, and they are "not by the user" too.
    @Test
    void buildTicketQuery_escalatedByUserFalse_ticketsWithoutTheValueIncluded() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().escalatedByUser(false).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query.get(ESCALATED_BY_USER, Document.class)).containsEntry("$ne", true);
    }

    @Test
    void buildTicketQuery_hasPendingApprovalTrue_onlyFlaggedTickets() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().hasPendingApproval(true).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query).containsEntry(HAS_PENDING_APPROVAL, true);
    }

    // Tickets created before the flag existed carry no value, and they are "not waiting" too.
    @Test
    void buildTicketQuery_hasPendingApprovalFalse_ticketsWithoutTheValueIncluded() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().hasPendingApproval(false).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query.get(HAS_PENDING_APPROVAL, Document.class)).containsEntry("$ne", true);
    }

    @Test
    void buildTicketQuery_emptyRestriction_matchesNothing() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, List.of(), null).getQueryObject();

        // verifications
        assertThat(query).containsEntry("_id", null);
    }

    @Test
    void updatePendingApproval_flagSet_singleFieldUpdate() {
        // execution
        repository.updatePendingApproval("t-1", true);

        // verifications
        verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry("_id", "t-1");
        assertThat(updateCaptor.getValue().getUpdateObject().get("$set", Document.class))
                .containsEntry(HAS_PENDING_APPROVAL, true)
                .hasSize(1);
    }

    @Test
    void buildTicketQuery_escalatedByUserOmitted_noNarrowing() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query).doesNotContainKey(ESCALATED_BY_USER);
    }

    @Test
    void buildTicketQuery_ownerScopeWithOrganization_machineAndOrganizationSnapshotOrLegacyNull() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b");

        // execution
        Document query = repository.buildTicketQuery(null, null, null, scope).getQueryObject();

        // verifications
        assertThat(query).containsEntry("owner.machineId", "machine-1");
        assertThat(query.get("owner.organizationId", Document.class))
                .isEqualTo(new Document("$in", Arrays.asList("org-b", null)));
    }

    @Test
    void buildTicketQuery_ownerScopeWithoutOrganization_machineOnly() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", null);

        // execution
        Document query = repository.buildTicketQuery(null, null, null, scope).getQueryObject();

        // verifications
        assertThat(query).containsEntry("owner.machineId", "machine-1");
        assertThat(query).doesNotContainKey("owner.organizationId");
    }

    @Test
    void buildTicketQuery_ownerScopeAndSearch_bothClausesKept() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b");

        // execution
        Document query = repository.buildTicketQuery(null, "printer", null, scope).getQueryObject();

        // verifications
        assertThat(query).containsKeys("owner.machineId", "owner.organizationId", "$or");
    }

    @Test
    void buildTicketQuery_noOwnerScope_noOwnerClauses() {
        // execution
        Document query = repository.buildTicketQuery(null, null, null, null).getQueryObject();

        // verifications
        assertThat(query).doesNotContainKeys("owner.machineId", "owner.organizationId");
    }
}
