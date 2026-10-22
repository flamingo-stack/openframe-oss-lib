package com.openframe.data.repository.ticket;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.Ticket;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

// The projections' ticket writes. Not TicketRepository: that one is tenant-aware and not created in the shared stream,
// where the projections run, so every write here names its tenant.
@Repository
@RequiredArgsConstructor
public class TicketProjectionRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_ORGANIZATION_NAME = "organizationName";

    private final MongoOperations mongoOperations;

    // Only tickets with another name change; Ticket.class makes Spring add $inc on @Version, so a stale copy fails to save.
    public long updateOrganizationName(String tenantId, String organizationId, String organizationName) {
        Criteria outdatedCopies = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_ORGANIZATION_ID).is(organizationId)
                .and(FIELD_ORGANIZATION_NAME).ne(organizationName);
        Query query = new Query(outdatedCopies);
        Update update = new Update().set(FIELD_ORGANIZATION_NAME, organizationName);
        UpdateResult result = mongoOperations.updateMulti(query, update, Ticket.class);
        return result.getModifiedCount();
    }
}
