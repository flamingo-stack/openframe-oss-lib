package com.openframe.management.migration;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@ChangeUnit(id = "backfill-ticket-orders", order = "003", author = "openframe")
public class BackfillTicketOrdersChangeUnit {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS_ID = "statusId";
    private static final String FIELD_ORDER = "order";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String LIFECYCLE_FLAG = "openframe.features.tickets.lifecycle.enabled";

    @Execution
    public void execution(MongoTemplate mongoTemplate,
                          TenantIdProvider tenantIdProvider,
                          Environment environment) {
        // TODO(lifecycle-rollout): remove guard + drop Environment param after rollout
        if (!environment.getProperty(LIFECYCLE_FLAG, Boolean.class, false)) {
            log.info("Backfill ticket orders: lifecycle feature disabled; skipping");
            return;
        }
        String tenantId = tenantIdProvider.getTenantId();
        if (!hasText(tenantId)) {
            log.warn("Backfill ticket orders: tenantId not available; skipping");
            return;
        }
        log.info("Backfill ticket orders: tenant {}", tenantId);
        List<String> statusIds = findDistinctStatusIds(mongoTemplate, tenantId);
        statusIds.forEach(statusId -> backfillColumn(mongoTemplate, tenantId, statusId));
        log.info("Backfill ticket orders: complete for tenant {}", tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private List<String> findDistinctStatusIds(MongoTemplate mongoTemplate, String tenantId) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId));
        return mongoTemplate.findDistinct(query, FIELD_STATUS_ID, Ticket.class, String.class);
    }

    private void backfillColumn(MongoTemplate mongoTemplate, String tenantId, String statusId) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_STATUS_ID).is(statusId)
                .and(FIELD_ORDER).is(null));
        query.with(Sort.by(Sort.Direction.DESC, FIELD_CREATED_AT));
        List<Ticket> tickets = mongoTemplate.find(query, Ticket.class);

        if (tickets.isEmpty()) {
            return;
        }

        LexoRank rank = LexoRank.middle();
        for (Ticket ticket : tickets) {
            assignOrder(mongoTemplate, tenantId, ticket.getId(), rank.format());
            rank = rank.genNext();
        }
        log.info("Backfill ticket orders: tenant {} statusId {} → {} ticket(s)",
                tenantId, statusId, tickets.size());
    }

    private void assignOrder(MongoTemplate mongoTemplate, String tenantId, String ticketId, String order) {
        Query byId = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_ID).is(ticketId));
        Update update = new Update().set(FIELD_ORDER, order);
        mongoTemplate.updateFirst(byId, update, Ticket.class);
    }
}
