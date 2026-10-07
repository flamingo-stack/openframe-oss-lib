package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bulk archive takes the same filter as the list it is invoked from, so every axis the list narrows
 * on must narrow the archive too — a device-scoped "archive resolved" must not sweep the tenant.
 */
@ExtendWith(MockitoExtension.class)
class TicketLifecycleServiceArchiveFilterTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketStatusDefinitionRepository statusRepository;
    @Mock private TicketTransitionPolicyValidator transitionPolicy;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private TicketStatusHistoryService historyService;
    @Mock private TicketEventListener listener;

    private final AuthPrincipal admin = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
    private final TicketStatusDefinition resolved = definition("st-resolved", TicketStatusKind.RESOLVED);
    private final TicketStatusDefinition archived = definition("st-archived", TicketStatusKind.ARCHIVED);
    private final Query query = new Query();

    private TicketLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new TicketLifecycleService(ticketRepository, statusRepository, transitionPolicy,
                tenantIdProvider, ticketTagService, ticketIdsForFilter, ticketResolverStamp,
                historyService, List.of(listener));
        when(statusRepository.findByKind(TicketStatusKind.RESOLVED)).thenReturn(Optional.of(resolved));
        when(statusRepository.findByKind(TicketStatusKind.ARCHIVED)).thenReturn(Optional.of(archived));
        when(ticketRepository.buildTicketQuery(any(), isNull(), any(), isNull())).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), anyInt(), any(), any())).thenReturn(List.of());
    }

    @Test
    void archiveResolved_narrowsToTheRequestedDevices() {
        TicketFilterInput filter = TicketFilterInput.builder()
                .organizationIds(List.of("org-1"))
                .deviceIds(List.of("machine-1"))
                .build();

        service.archiveResolvedTickets(admin, filter);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getStatusIds()).containsExactly(resolved.getId());
        assertThat(captured.getOrganizationIds()).containsExactly("org-1");
        assertThat(captured.getDeviceIds()).containsExactly("machine-1");
    }

    @Test
    void archiveResolved_withoutFilter_isResolvedColumnOnly() {
        service.archiveResolvedTickets(admin, null);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getStatusIds()).containsExactly(resolved.getId());
        assertThat(captured.getDeviceIds()).isNull();
        assertThat(captured.getOrganizationIds()).isNull();
    }

    private TicketQueryFilter capturedFilter() {
        ArgumentCaptor<TicketQueryFilter> captor = ArgumentCaptor.forClass(TicketQueryFilter.class);
        verify(ticketRepository, atLeastOnce()).buildTicketQuery(captor.capture(), isNull(), any(), isNull());
        return captor.getValue();
    }

    private static TicketStatusDefinition definition(String id, TicketStatusKind kind) {
        return TicketStatusDefinition.builder().id(id).kind(kind).name(id).build();
    }
}
