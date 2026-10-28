package com.openframe.management.migration;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BackfillTicketOwnerOrganizationIdChangeUnitTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TICKETS = "tickets";
    private static final String MACHINES = "machines";
    private static final String OWNER_ORGANIZATION_ID = "owner.organizationId";

    @Mock private MongoTemplate mongoTemplate;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private MongoCollection<Document> tickets;

    private final BackfillTicketOwnerOrganizationIdChangeUnit changeUnit = new BackfillTicketOwnerOrganizationIdChangeUnit();

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(mongoTemplate.getCollection(TICKETS)).thenReturn(tickets);
        when(tickets.updateMany(any(Bson.class), anyList())).thenReturn(UpdateResult.acknowledged(3, 3L, null));
    }

    @Test
    void execution_clientTicketsWithOrganization_snapshotCopiedFromTheTicketOnly() {
        // setup
        when(mongoTemplate.findDistinct(any(Query.class), eq("owner.machineId"), eq(TICKETS), eq(String.class)))
                .thenReturn(List.of());

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Document>> pipeline = ArgumentCaptor.forClass(List.class);
        verify(tickets).updateMany(filter.capture(), pipeline.capture());
        assertThat(filter.getValue()).isEqualTo(new Document("tenantId", TENANT_ID)
                .append("owner.ticketOwnerType", "CLIENT")
                .append(OWNER_ORGANIZATION_ID, new Document("$exists", false))
                .append("organizationId", new Document("$ne", null)));
        assertThat(pipeline.getValue()).containsExactly(
                new Document("$set", new Document(OWNER_ORGANIZATION_ID, "$organizationId")));
        verify(mongoTemplate, never()).updateMulti(any(Query.class), any(Update.class), eq(TICKETS));
    }

    @Test
    void execution_ticketWithoutOrganization_snapshotTakenFromTheMachine() {
        // setup
        when(mongoTemplate.findDistinct(any(Query.class), eq("owner.machineId"), eq(TICKETS), eq(String.class)))
                .thenReturn(List.of("machine-1"));
        when(mongoTemplate.findOne(any(Query.class), eq(Document.class), eq(MACHINES)))
                .thenReturn(new Document("machineId", "machine-1").append("organizationId", "org-b"));
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(TICKETS)))
                .thenReturn(UpdateResult.acknowledged(2, 2L, null));

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(query.capture(), update.capture(), eq(TICKETS));
        assertThat(query.getValue().getQueryObject()).isEqualTo(new Document("tenantId", TENANT_ID)
                .append("owner.ticketOwnerType", "CLIENT")
                .append(OWNER_ORGANIZATION_ID, new Document("$exists", false))
                .append("owner.machineId", "machine-1"));
        assertThat(update.getValue().getUpdateObject())
                .isEqualTo(new Document("$set", new Document(OWNER_ORGANIZATION_ID, "org-b")));
    }

    @Test
    void execution_machineWithoutOrganization_ticketsLeftUntouched() {
        // setup
        when(mongoTemplate.findDistinct(any(Query.class), eq("owner.machineId"), eq(TICKETS), eq(String.class)))
                .thenReturn(List.of("machine-1"));
        when(mongoTemplate.findOne(any(Query.class), eq(Document.class), eq(MACHINES))).thenReturn(null);

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        verify(mongoTemplate, never()).updateMulti(any(Query.class), any(Update.class), eq(TICKETS));
    }
}
