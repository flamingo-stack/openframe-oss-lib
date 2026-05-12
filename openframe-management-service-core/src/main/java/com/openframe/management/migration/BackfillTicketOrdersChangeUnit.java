package com.openframe.management.migration;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
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

@Slf4j
@ChangeUnit(id = "backfill-ticket-orders", order = "002", author = "openframe")
public class BackfillTicketOrdersChangeUnit {

    private static final String STATUS_FIELD = "status";
    private static final String ORDER_FIELD = "order";
    private static final String CREATED_AT_FIELD = "createdAt";
    private static final String ID_FIELD = "_id";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        for (TicketStatus status : TicketStatus.values()) {
            backfillColumn(mongoTemplate, status);
        }
    }

    @RollbackExecution
    public void rollback() {
    }

    private void backfillColumn(MongoTemplate mongoTemplate, TicketStatus status) {
        Query query = new Query(Criteria.where(STATUS_FIELD).is(status)
                .and(ORDER_FIELD).is(null));
        query.with(Sort.by(Sort.Direction.DESC, CREATED_AT_FIELD));
        List<Ticket> tickets = mongoTemplate.find(query, Ticket.class);

        LexoRank rank = LexoRank.middle();
        for (Ticket ticket : tickets) {
            assignOrder(mongoTemplate, ticket.getId(), rank.format());
            rank = rank.genNext();
        }
        log.info("Backfilled order on {} tickets in status {}", tickets.size(), status);
    }

    private void assignOrder(MongoTemplate mongoTemplate, String ticketId, String order) {
        Query byId = new Query(Criteria.where(ID_FIELD).is(ticketId));
        Update update = new Update().set(ORDER_FIELD, order);
        mongoTemplate.updateFirst(byId, update, Ticket.class);
    }
}
