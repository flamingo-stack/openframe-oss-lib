package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LookupNodeLoaderTest {

    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";

    @Mock private Function<String, Optional<SupportTicket>> rawIdLookup;
    @Mock private BiFunction<AuthPrincipal, String, Optional<SupportTicket>> principalLookup;

    private AuthPrincipal principal;
    private SupportTicket ticket;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("user-1").build();
        ticket = new SupportTicket(TICKET_ID, "Printer jam");
    }

    @Test
    void find_byRawId_rawIdLookedUpWithoutThePrincipal() {
        // setup
        when(rawIdLookup.apply(TICKET_ID)).thenReturn(Optional.of(ticket));
        LookupNodeLoader<SupportTicket> loader = LookupNodeLoader.byRawId(NodeType.TICKET, SupportTicket.class, rawIdLookup);

        // execution
        Optional<SupportTicket> found = loader.find(principal, TICKET_ID);

        // verifications
        assertThat(found).containsSame(ticket);
    }

    @Test
    void find_byPrincipalAndRawId_principalAndRawIdLookedUp() {
        // setup
        when(principalLookup.apply(principal, TICKET_ID)).thenReturn(Optional.of(ticket));
        LookupNodeLoader<SupportTicket> loader =
                LookupNodeLoader.byPrincipalAndRawId(NodeType.TICKET, SupportTicket.class, principalLookup);

        // execution
        Optional<SupportTicket> found = loader.find(principal, TICKET_ID);

        // verifications
        assertThat(found).containsSame(ticket);
    }

    @Test
    void typeAndNodeClass_declared_answeredAsGiven() {
        // setup
        LookupNodeLoader<SupportTicket> loader = LookupNodeLoader.byRawId(NodeType.TICKET, SupportTicket.class, rawIdLookup);

        // execution
        NodeType type = loader.type();
        Class<SupportTicket> nodeClass = loader.nodeClass();

        // verifications
        assertThat(type).isEqualTo(NodeType.TICKET);
        assertThat(nodeClass).isEqualTo(SupportTicket.class);
    }
}
