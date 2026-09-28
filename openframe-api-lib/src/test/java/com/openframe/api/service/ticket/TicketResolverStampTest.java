package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A closed ticket must say who closed it: a technician, identifiable by id, or the client, who has
 * no user record and therefore no id and no name. A closing the assistant performed counts as the
 * client's — it never closes anything without being asked.
 */
class TicketResolverStampTest {

    private static final String TECHNICIAN_ID = "user-7";
    private static final String ASSISTANT_NAME = "Fae";

    private final UserRepository userRepository = mock(UserRepository.class);
    private final TicketResolverStamp stamp = new TicketResolverStamp(userRepository);

    @Test
    void stamp_assistantPrincipal_resolvedByEndUserWithoutIdOrName() {
        // setup — the assistant closes only on the client's word, so the client is the resolver
        Ticket ticket = new Ticket();
        AuthPrincipal principal = AuthPrincipal.builder()
                .id(TicketResolverStamp.AI_AGENT_ID)
                .firstName(ASSISTANT_NAME)
                .actorType(ActorType.AGENT)
                .build();

        // execution
        stamp.stamp(ticket, principal);

        // verifications
        assertThat(ticket.getResolvedBy()).isEqualTo(TicketResolver.END_USER);
        assertThat(ticket.getResolvedById()).isNull();
        assertThat(ticket.getResolvedByName()).isNull();
    }

    @Test
    void stamp_technicianPrincipal_resolvedByTechnicianWithProfileName() {
        // setup — the profile name wins over whatever the token carries
        Ticket ticket = new Ticket();
        AuthPrincipal principal = AuthPrincipal.builder()
                .id(TECHNICIAN_ID)
                .firstName("token-name")
                .actorType(ActorType.ADMIN)
                .build();
        when(userRepository.findById(TECHNICIAN_ID)).thenReturn(Optional.of(
                User.builder().id(TECHNICIAN_ID).firstName("Roman").lastName("Smith").build()));

        // execution
        stamp.stamp(ticket, principal);

        // verifications
        assertThat(ticket.getResolvedBy()).isEqualTo(TicketResolver.TECHNICIAN);
        assertThat(ticket.getResolvedById()).isEqualTo(TECHNICIAN_ID);
        assertThat(ticket.getResolvedByName()).isEqualTo("Roman Smith");
    }

    @Test
    void stamp_technicianWithoutAnyName_nameFallsBackToId() {
        // setup — no profile and no token name
        Ticket ticket = new Ticket();
        AuthPrincipal principal = AuthPrincipal.builder()
                .id(TECHNICIAN_ID)
                .actorType(ActorType.ADMIN)
                .build();
        when(userRepository.findById(TECHNICIAN_ID)).thenReturn(Optional.empty());

        // execution
        stamp.stamp(ticket, principal);

        // verifications
        assertThat(ticket.getResolvedByName()).isEqualTo(TECHNICIAN_ID);
    }
}
