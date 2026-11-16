package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.ticket.spi.TicketPendingApprovalProvider;
import com.openframe.api.service.ticket.spi.TicketUnreadMessagesProvider;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.EntityCount;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketIdsForFilterTest {

    private static final String TENANT_ID = "tenant-1";
    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private TicketTagService ticketTagService;
    @Mock private NotificationReadStateRepository readStateRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private ObjectProvider<TicketUnreadMessagesProvider> unreadMessagesProvider;
    @Mock private TicketUnreadMessagesProvider provider;
    @Mock private ObjectProvider<TicketPendingApprovalProvider> pendingApprovalProvider;
    @Mock private TicketPendingApprovalProvider pendingApproval;

    private TicketIdsForFilter ticketIdsForFilter;

    @BeforeEach
    void setUp() {
        ticketIdsForFilter = new TicketIdsForFilter(ticketTagService, readStateRepository, tenantIdProvider,
                unreadMessagesProvider, pendingApprovalProvider);
    }

    @Test
    void resolve_noFilter_noRestriction() {
        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, null);

        // verifications
        assertThat(restricted).isNull();
        verifyNoInteractions(readStateRepository, unreadMessagesProvider);
    }

    @Test
    void resolve_unreadOnlyWithProvider_unreadMessagesDecide() {
        // setup — a wired conversation store answers from the dialog counters, not from notifications
        when(unreadMessagesProvider.getIfAvailable()).thenReturn(provider);
        when(provider.ticketIdsWithUnreadMessages(ADMIN)).thenReturn(List.of("ticket-1", "ticket-2"));

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, unreadOnly());

        // verifications
        assertThat(restricted).containsExactly("ticket-1", "ticket-2");
        verifyNoInteractions(readStateRepository);
    }

    @Test
    void resolve_unreadOnlyWithProviderAndNothingUnread_emptyNotNull() {
        // setup — a filter that applied and found nothing must not collapse to "no restriction"
        when(unreadMessagesProvider.getIfAvailable()).thenReturn(provider);
        when(provider.ticketIdsWithUnreadMessages(ADMIN)).thenReturn(List.of());

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, unreadOnly());

        // verifications
        assertThat(restricted).isNotNull().isEmpty();
    }

    @Test
    void resolve_unreadOnlyWithoutProvider_unreadNotificationsDecide() {
        // setup
        when(unreadMessagesProvider.getIfAvailable()).thenReturn(null);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(readStateRepository.unreadCountsByEntity("admin-1", RecipientType.USER, NotificationEntityType.TICKET, TENANT_ID))
                .thenReturn(List.of(new EntityCount("ticket-9", 3)));

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, unreadOnly());

        // verifications
        assertThat(restricted).containsExactly("ticket-9");
    }

    @Test
    void resolve_tagsAndUnread_intersected() {
        // setup
        when(ticketTagService.getTicketIdsByTagIds(List.of("tag-1"))).thenReturn(List.of("ticket-1", "ticket-2", "ticket-3"));
        when(unreadMessagesProvider.getIfAvailable()).thenReturn(provider);
        when(provider.ticketIdsWithUnreadMessages(ADMIN)).thenReturn(List.of("ticket-2", "ticket-4"));
        TicketFilterInput filter = unreadOnly();
        filter.setTagIds(List.of("tag-1"));

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, filter);

        // verifications
        assertThat(restricted).containsExactly("ticket-2");
    }

    @Test
    void resolve_pendingApprovalOnly_requestsDecide() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(pendingApproval);
        when(pendingApproval.ticketIdsWithPendingApproval()).thenReturn(List.of("ticket-5"));

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, pendingApproval(true));

        // verifications
        assertThat(restricted).containsExactly("ticket-5");
    }

    // A deployment without approvals has nothing waiting: the filter matches no ticket, not every ticket.
    @Test
    void resolve_pendingApprovalOnlyWithoutProvider_emptyNotNull() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(null);

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, pendingApproval(true));

        // verifications
        assertThat(restricted).isNotNull().isEmpty();
    }

    @Test
    void resolve_tagsAndPendingApproval_intersected() {
        // setup
        when(ticketTagService.getTicketIdsByTagIds(List.of("tag-1"))).thenReturn(List.of("ticket-1", "ticket-2"));
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(pendingApproval);
        when(pendingApproval.ticketIdsWithPendingApproval()).thenReturn(List.of("ticket-2", "ticket-7"));
        TicketFilterInput filter = pendingApproval(true);
        filter.setTagIds(List.of("tag-1"));

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, filter);

        // verifications
        assertThat(restricted).containsExactly("ticket-2");
    }

    // false is an exclusion, never a restriction: resolve leaves it to excludedTicketIds.
    @Test
    void resolve_pendingApprovalFalse_noRestriction() {
        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, pendingApproval(false));

        // verifications
        assertThat(restricted).isNull();
        verifyNoInteractions(pendingApprovalProvider);
    }

    @Test
    void excludedTicketIds_pendingApprovalFalse_pendingTicketsLeftOut() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(pendingApproval);
        when(pendingApproval.ticketIdsWithPendingApproval()).thenReturn(List.of("ticket-5"));

        // execution
        List<String> excluded = ticketIdsForFilter.excludedTicketIds(pendingApproval(false));

        // verifications
        assertThat(excluded).containsExactly("ticket-5");
    }

    @Test
    void excludedTicketIds_pendingApprovalTrue_nothingExcluded() {
        // execution
        List<String> excluded = ticketIdsForFilter.excludedTicketIds(pendingApproval(true));

        // verifications
        assertThat(excluded).isNull();
        verifyNoInteractions(pendingApprovalProvider);
    }

    @Test
    void excludedTicketIds_noFilter_nothingExcluded() {
        // execution
        List<String> excluded = ticketIdsForFilter.excludedTicketIds(null);

        // verifications
        assertThat(excluded).isNull();
        verifyNoInteractions(pendingApprovalProvider);
    }

    @Test
    void excludedTicketIds_pendingApprovalOmitted_nothingExcluded() {
        // setup
        TicketFilterInput filter = new TicketFilterInput();

        // execution
        List<String> excluded = ticketIdsForFilter.excludedTicketIds(filter);

        // verifications
        assertThat(excluded).isNull();
        verifyNoInteractions(pendingApprovalProvider);
    }

    private TicketFilterInput pendingApproval(boolean pending) {
        TicketFilterInput filter = new TicketFilterInput();
        filter.setHasPendingApproval(pending);
        return filter;
    }

    private TicketFilterInput unreadOnly() {
        TicketFilterInput filter = new TicketFilterInput();
        filter.setHasUnreadNotifications(true);
        return filter;
    }
}
