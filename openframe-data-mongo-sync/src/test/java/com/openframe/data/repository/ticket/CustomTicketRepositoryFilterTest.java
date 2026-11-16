package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class CustomTicketRepositoryFilterTest {

    private static final Instant CUT_OFF = Instant.parse("2026-10-20T10:00:00Z");

    private static final String ESCALATED_BY_USER = "escalatedByUser";

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Mock private ObjectProvider<OutboxPublisher> outboxPublisher;
    @Mock private ObjectProvider<TicketAggregateSpec> ticketSpec;

    private CustomTicketRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher, ticketSpec);
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
    void buildTicketQuery_emptyRestriction_matchesNothing() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, List.of(), null).getQueryObject();

        // verifications
        assertThat(query).containsEntry("_id", null);
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
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", null);

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
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", null, null);

        // execution
        Document query = repository.buildTicketQuery(null, null, null, scope).getQueryObject();

        // verifications
        assertThat(query).containsEntry("owner.machineId", "machine-1");
        assertThat(query).doesNotContainKey("owner.organizationId");
    }

    @Test
    void buildTicketQuery_ownerScopeAndSearch_bothClausesKept() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", null);

        // execution
        Document query = repository.buildTicketQuery(null, "printer", null, scope).getQueryObject();

        // verifications
        assertThat(query).containsKeys("owner.machineId", "owner.organizationId", "$or");
    }

    @Test
    void buildTicketQuery_ownerScopeWithCutOffAndNoFilter_createdAtStartsAtTheCutOff() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", CUT_OFF);

        // execution
        Document query = repository.buildTicketQuery(null, null, null, scope).getQueryObject();

        // verifications
        assertThat(query.get("createdAt", Document.class)).isEqualTo(new Document("$gte", CUT_OFF));
    }

    @Test
    void buildTicketQuery_ownerScopeWithCutOffAndEarlierCreatedAtFrom_cutOffWins() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", CUT_OFF);
        TicketQueryFilter filter = TicketQueryFilter.builder().createdAtFrom(CUT_OFF.minusSeconds(60)).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, scope).getQueryObject();

        // verifications
        assertThat(query.get("createdAt", Document.class)).isEqualTo(new Document("$gte", CUT_OFF));
    }

    @Test
    void buildTicketQuery_ownerScopeWithCutOffAndLaterCreatedAtFrom_filterWins() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", CUT_OFF);
        TicketQueryFilter filter = TicketQueryFilter.builder().createdAtFrom(CUT_OFF.plusSeconds(60)).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, scope).getQueryObject();

        // verifications
        assertThat(query.get("createdAt", Document.class)).isEqualTo(new Document("$gte", CUT_OFF.plusSeconds(60)));
    }

    @Test
    void buildTicketQuery_ownerScopeWithCutOffAndCreatedAtTo_bothBoundsKept() {
        // setup
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", CUT_OFF);
        TicketQueryFilter filter = TicketQueryFilter.builder().createdAtTo(CUT_OFF.plusSeconds(60)).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, scope).getQueryObject();

        // verifications
        assertThat(query.get("createdAt", Document.class))
                .isEqualTo(new Document("$gte", CUT_OFF).append("$lt", CUT_OFF.plusSeconds(60)));
    }

    @Test
    void buildTicketQuery_noOwnerScope_noOwnerClauses() {
        // execution
        Document query = repository.buildTicketQuery(null, null, null, null).getQueryObject();

        // verifications
        assertThat(query).doesNotContainKeys("owner.machineId", "owner.organizationId", "createdAt");
    }
}
