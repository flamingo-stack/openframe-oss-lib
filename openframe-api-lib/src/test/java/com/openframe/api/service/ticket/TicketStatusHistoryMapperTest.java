package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketActorType;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The mapper owns the shape of a history row: kinds land as plain {@code name()} strings, status
 * names as snapshots, the auth actor type as the document-local enum, and the audit fields stay
 * for Mongo to fill. The history service only wires the row to the repository.
 */
class TicketStatusHistoryMapperTest {

    private static final String TICKET_ID = "ticket-1";
    private static final String ADMIN_ID = "admin-1";

    private final TicketStatusHistoryMapper mapper = new TicketStatusHistoryMapper();

    @Test
    void toHistory_mapsEveryFieldFromItsSource() {
        // execution
        TicketStatusHistory row = mapper.toHistory(ticket(), resolvedStatus(), techStatus(),
                adminPrincipal(), "problem is back");

        // verifications
        assertThat(row.getTicketId()).isEqualTo(TICKET_ID);
        assertThat(row.getFromStatusId()).isEqualTo("st-resolved");
        assertThat(row.getFromStatusKind()).isEqualTo("RESOLVED");
        assertThat(row.getFromStatusName()).isEqualTo("Resolved");
        assertThat(row.getToStatusId()).isEqualTo("st-tech");
        assertThat(row.getToStatusKind()).isEqualTo("TECH_REQUIRED");
        assertThat(row.getToStatusName()).isEqualTo("Tech Required");
        assertThat(row.getActorId()).isEqualTo(ADMIN_ID);
        assertThat(row.getActorType()).isEqualTo(TicketActorType.ADMIN);
        assertThat(row.getReason()).isEqualTo("problem is back");
    }

    @Test
    void toHistory_agentPrincipal_mapsToAgentActor() {
        // setup
        AuthPrincipal agent = AuthPrincipal.builder().id("machine-1").actorType(ActorType.AGENT).build();

        // execution
        TicketStatusHistory row = mapper.toHistory(ticket(), resolvedStatus(), techStatus(), agent, null);

        // verifications
        assertThat(row.getActorType()).isEqualTo(TicketActorType.AGENT);
        assertThat(row.getActorId()).isEqualTo("machine-1");
    }

    @Test
    void toHistory_missingKindAndActorType_stayNull() {
        // setup
        TicketStatusDefinition kindless = TicketStatusDefinition.builder().id("st-x").name("X").build();
        AuthPrincipal typeless = AuthPrincipal.builder().id("who-1").build();

        // execution
        TicketStatusHistory row = mapper.toHistory(ticket(), kindless, kindless, typeless, null);

        // verifications
        assertThat(row.getFromStatusKind()).isNull();
        assertThat(row.getToStatusKind()).isNull();
        assertThat(row.getActorType()).isNull();
    }

    @Test
    void toHistory_leavesAuditFieldsForMongo() {
        // execution
        TicketStatusHistory row = mapper.toHistory(ticket(), resolvedStatus(), techStatus(),
                adminPrincipal(), null);

        // verifications
        assertThat(row.getId()).isNull();
        assertThat(row.getTenantId()).isNull();
        assertThat(row.getCreatedAt()).isNull();
    }

    private Ticket ticket() {
        return Ticket.builder().id(TICKET_ID).build();
    }

    private TicketStatusDefinition resolvedStatus() {
        return TicketStatusDefinition.builder().id("st-resolved").kind(TicketStatusKind.RESOLVED).name("Resolved").build();
    }

    private TicketStatusDefinition techStatus() {
        return TicketStatusDefinition.builder().id("st-tech").kind(TicketStatusKind.TECH_REQUIRED).name("Tech Required").build();
    }

    private AuthPrincipal adminPrincipal() {
        return AuthPrincipal.builder().id(ADMIN_ID).actorType(ActorType.ADMIN).build();
    }
}
