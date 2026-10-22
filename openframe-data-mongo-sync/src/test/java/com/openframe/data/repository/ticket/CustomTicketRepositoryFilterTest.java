package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class CustomTicketRepositoryFilterTest {

    private static final String ESCALATED_BY_USER = "escalatedByUser";

    @Mock private TenantAwareMongoTemplate mongoTemplate;

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
    void buildTicketQuery_excludedTicketIdsAlone_leftOutWithNin() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().excludedTicketIds(List.of("t-1")).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, null, null).getQueryObject();

        // verifications
        assertThat(query.get("_id", Document.class)).containsEntry("$nin", List.of("t-1"));
    }

    // Two criteria on _id are rejected by Query, so the exclusions are taken out of the inclusion list instead.
    @Test
    void buildTicketQuery_restrictionAndExclusions_exclusionsRemovedFromTheInclusionList() {
        // setup
        TicketQueryFilter filter = TicketQueryFilter.builder().excludedTicketIds(List.of("t-2")).build();

        // execution
        Document query = repository.buildTicketQuery(filter, null, List.of("t-1", "t-2"), null).getQueryObject();

        // verifications
        assertThat(query.get("_id", Document.class)).containsEntry("$in", List.of("t-1"));
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
}
