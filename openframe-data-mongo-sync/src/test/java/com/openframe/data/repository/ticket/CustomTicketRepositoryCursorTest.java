package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomTicketRepositoryCursorTest {

    private static final String ID_FIELD = "_id";
    private static final String AND_OPERATOR = "$and";
    private static final String OR_OPERATOR = "$or";

    private final TenantAwareMongoTemplate mongoTemplate = mock(TenantAwareMongoTemplate.class);
    private final CustomTicketRepositoryImpl repository = new CustomTicketRepositoryImpl(mongoTemplate);

    @Test
    @DisplayName("Given a query already restricted by ticket ids, when a cursor page is fetched sorted by _id, then both the id restriction and the cursor bound survive instead of Query rejecting the second '_id' criterion")
    void keepsIdRestrictionAlongsideIdCursorBound() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        Query filtered = repository.buildTicketQuery(null, null, List.of("ticket-1", "ticket-2"), null);
        ObjectId cursorId = new ObjectId();

        repository.findTicketsWithCursor(filtered, cursorId.toHexString(), 20, ID_FIELD, "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(ID_FIELD, Document.class).get("$in"))
                .isEqualTo(List.of("ticket-1", "ticket-2"));
        assertThat(cursorBoundOf(executed).get(ID_FIELD, Document.class).get("$lt"))
                .isEqualTo(cursorId);
    }

    @Test
    @DisplayName("Given a search query, when a cursor page is fetched sorted by a field other than _id, then the search's $or and the cursor's own $or coexist instead of colliding on the same key")
    void keepsSearchAlongsideNonIdCursorBound() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        when(mongoTemplate.findById(any(), eq(Ticket.class)))
                .thenReturn(Ticket.builder().createdAt(Instant.parse("2026-08-01T00:00:00Z")).build());
        Query searched = repository.buildTicketQuery(null, "printer", null, null);

        repository.findTicketsWithCursor(searched, new ObjectId().toHexString(), 20, "createdAt", "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(OR_OPERATOR)).isNotNull();
        assertThat(cursorBoundOf(executed).get(OR_OPERATOR)).isNotNull();
    }

    @Test
    @DisplayName("Given no cursor, when the first page is fetched, then no $and wrapper is introduced and the plain filter is executed as-is")
    void leavesFirstPageQueryUntouched() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        Query filtered = repository.buildTicketQuery(null, null, List.of("ticket-1"), null);

        repository.findTicketsWithCursor(filtered, null, 20, ID_FIELD, "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(AND_OPERATOR)).isNull();
        assertThat(executed.get(ID_FIELD, Document.class).get("$in")).isEqualTo(List.of("ticket-1"));
    }

    private Document captureExecutedQuery() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(Ticket.class));
        return captor.getValue().getQueryObject();
    }

    private Document cursorBoundOf(Document executed) {
        List<?> conjuncts = executed.getList(AND_OPERATOR, Object.class);
        assertThat(conjuncts).hasSize(1);
        return (Document) conjuncts.get(0);
    }
}
