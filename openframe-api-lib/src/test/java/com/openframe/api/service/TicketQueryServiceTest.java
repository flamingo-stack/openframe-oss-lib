package com.openframe.api.service;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.ticket.CustomTicketRepository;
import com.openframe.data.repository.ticket.CustomTicketRepositoryImpl;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketQueryServiceTest {

    private static final String CREATED_AT = "createdAt";
    private static final String DESC = "DESC";
    private static final String SEARCH = "printer";
    private static final String AFTER_TICKET_ID = "65f1a2b3c4d5e6f708192a3b";
    private static final int LIMIT = 26;
    private static final CursorPosition NO_POSITION = new CursorPosition.None();

    @Mock private TicketRepository ticketRepository;
    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Mock private ObjectProvider<OutboxPublisher> outboxPublisher;
    @Mock private ObjectProvider<TicketAggregateSpec> ticketSpec;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks private TicketQueryService service;

    private TicketQueryFilter filter;
    private Query query;
    private List<Ticket> found;

    @BeforeEach
    void setUp() {
        filter = new TicketQueryFilter();
        query = new Query();
        found = List.of(Ticket.builder().id("ticket-1").build(), Ticket.builder().id("ticket-2").build());
    }

    @Test
    void searchTickets_withoutAnAfterTicketId_newestFirstFromTheStart() {
        // setup
        when(ticketRepository.buildTicketQuery(filter, SEARCH, null, null)).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(query, NO_POSITION, false, LIMIT, CREATED_AT, DESC))
                .thenReturn(found);

        // execution
        List<Ticket> result = service.searchTickets(filter, SEARCH, LIMIT);

        // verifications
        assertThat(result).isEqualTo(found);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void searchTickets_noAfterTicketIdText_newestFirstFromTheStart(String afterTicketId) {
        // setup
        when(ticketRepository.buildTicketQuery(filter, SEARCH, null, null)).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(query, NO_POSITION, false, LIMIT, CREATED_AT, DESC))
                .thenReturn(found);

        // execution
        List<Ticket> result = service.searchTickets(filter, SEARCH, afterTicketId, LIMIT);

        // verifications
        assertThat(result).isEqualTo(found);
    }

    @Test
    void searchTickets_afterARawTicketId_newestFirstPastThatRow() {
        // setup
        CursorPosition afterRow = new CursorPosition.RowId(AFTER_TICKET_ID);
        when(ticketRepository.buildTicketQuery(filter, SEARCH, null, null)).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(query, afterRow, false, LIMIT, CREATED_AT, DESC))
                .thenReturn(found);

        // execution
        List<Ticket> result = service.searchTickets(filter, SEARCH, AFTER_TICKET_ID, LIMIT);

        // verifications
        assertThat(result).isEqualTo(found);
    }

    @Test
    void searchTickets_afterATicketThatWasRemoved_newestFirstPastThatId() {
        // setup
        CustomTicketRepository storedTickets = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher, ticketSpec);
        CursorPosition afterRow = new CursorPosition.RowId(AFTER_TICKET_ID);
        Document pastTheRemovedTicket = new Document("_id", new Document("$lt", new ObjectId(AFTER_TICKET_ID)));
        Document newestFirst = new Document(CREATED_AT, -1).append("_id", -1);
        when(ticketRepository.buildTicketQuery(filter, SEARCH, null, null)).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(query, afterRow, false, LIMIT, CREATED_AT, DESC))
                .thenAnswer(call -> storedTickets.findTicketsWithCursor(
                        query, afterRow, false, LIMIT, CREATED_AT, DESC));
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(null);
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(found);

        // execution
        List<Ticket> result = service.searchTickets(filter, SEARCH, AFTER_TICKET_ID, LIMIT);

        // verifications
        assertThat(result).isEqualTo(found);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query pageQuery = queryCaptor.getValue();
        assertThat(pageQuery.getQueryObject().getList("$and", Document.class)).containsExactly(pastTheRemovedTicket);
        assertThat(pageQuery.getSortObject()).containsExactlyEntriesOf(newestFirst);
    }

    @Test
    void searchTickets_repositoryRejectsTheRow_invalidCursorReachesTheCaller() {
        // setup
        CursorPosition afterRow = new CursorPosition.RowId(AFTER_TICKET_ID);
        when(ticketRepository.buildTicketQuery(filter, SEARCH, null, null)).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(query, afterRow, false, LIMIT, CREATED_AT, DESC))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> service.searchTickets(filter, SEARCH, AFTER_TICKET_ID, LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage("Invalid cursor");
    }
}
