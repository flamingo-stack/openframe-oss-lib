package com.openframe.data.repository.ticket;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketOwnerType;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketProjectionRepositoryTest {

    @Mock private MongoOperations mongoOperations;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    @InjectMocks private TicketProjectionRepository repository;

    @Test
    void archive_matchesOnlyTheMachinesOpenClientTicketsWithAnotherCustomersSnapshot_andArchivesThem() {
        // setup
        when(mongoOperations.updateMulti(any(Query.class), any(Update.class), eq(Ticket.class)))
                .thenReturn(UpdateResult.acknowledged(3, 3L, null));

        // execution
        long archived = repository.archiveClientTicketsOfOtherOrganizations("tenant-a", "machine-1", "org-b", "status-archived");

        // verifications
        verify(mongoOperations).updateMulti(queryCaptor.capture(), updateCaptor.capture(), eq(Ticket.class));
        Document criteria = queryCaptor.getValue().getQueryObject();
        assertThat(criteria).containsEntry("tenantId", "tenant-a")
                .containsEntry("owner.ticketOwnerType", TicketOwnerType.CLIENT)
                .containsEntry("owner.machineId", "machine-1");
        assertThat(criteria.get("owner.organizationId", Document.class))
                .isEqualTo(new Document("$nin", Arrays.asList(null, "org-b")));
        assertThat(criteria.get("statusKind", Document.class)).isEqualTo(new Document("$ne", TicketStatusKind.ARCHIVED));
        Document set = updateCaptor.getValue().getUpdateObject().get("$set", Document.class);
        assertThat(set).containsEntry("statusId", "status-archived")
                .containsEntry("statusKind", TicketStatusKind.ARCHIVED)
                .containsKey("updatedAt");
        assertThat(archived).isEqualTo(3);
    }

    @Test
    void batch_afterTheLastId_returnsNullWhenNothingIsLeft() {
        // setup
        when(mongoOperations.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());

        // execution
        String last = repository.archiveClientTicketsOfOtherOrganizationsBatch("tenant-a", "machine-1", "org-b",
                "status-archived", "t5", 100);

        // verifications
        assertThat(last).isNull();
        verify(mongoOperations).find(queryCaptor.capture(), eq(Ticket.class));
        // Fields.id is the property name; the QueryMapper turns it into _id when the query runs, as in the sibling methods.
        assertThat(queryCaptor.getValue().getQueryObject().get("id", Document.class)).isEqualTo(new Document("$gt", "t5"));
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(100);
    }

    @Test
    void findStatusId_readsTheTenantsStatusOfThatKind() {
        // setup
        TicketStatusDefinition archived = new TicketStatusDefinition();
        archived.setId("status-archived");
        when(mongoOperations.findOne(any(Query.class), eq(TicketStatusDefinition.class))).thenReturn(archived);

        // execution
        Optional<String> statusId = repository.findStatusId("tenant-a", TicketStatusKind.ARCHIVED);

        // verifications
        assertThat(statusId).contains("status-archived");
        verify(mongoOperations).findOne(queryCaptor.capture(), eq(TicketStatusDefinition.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", "tenant-a")
                .containsEntry("kind", TicketStatusKind.ARCHIVED);
    }
}
