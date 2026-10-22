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
    @Mock private TicketPendingApprovalProvider approvalProvider;

    private TicketIdsForFilter ticketIdsForFilter;

    @BeforeEach
    void setUp() {
        ticketIdsForFilter = new TicketIdsForFilter(ticketTagService, readStateRepository, tenantIdProvider,
                unreadMessagesProvider, pendingApprovalProvider);
    }

    @Test
    void resolve_pendingApprovalOnlyWithProvider_ticketsWaitingOnApprovalDecide() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(approvalProvider);
        when(approvalProvider.ticketIdsWithPendingApproval()).thenReturn(List.of("t-1"));
        TicketFilterInput filter = TicketFilterInput.builder().hasPendingApproval(true).build();

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, filter);

        // verifications
        assertThat(restricted).containsExactly("t-1");
    }

    // An OSS deployment has no approval requests; the filter then narrows nothing rather than hiding everything.
    @Test
    void resolve_pendingApprovalOnlyWithoutProvider_noRestriction() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(null);
        TicketFilterInput filter = TicketFilterInput.builder().hasPendingApproval(true).build();

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, filter);

        // verifications
        assertThat(restricted).isNull();
    }

    @Test
    void resolve_tagsAndPendingApproval_intersected() {
        // setup
        when(ticketTagService.getTicketIdsByTagIds(List.of("tag-1"))).thenReturn(List.of("t-1", "t-2"));
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(approvalProvider);
        when(approvalProvider.ticketIdsWithPendingApproval()).thenReturn(List.of("t-2", "t-3"));
        TicketFilterInput filter = TicketFilterInput.builder().tagIds(List.of("tag-1")).hasPendingApproval(true).build();

        // execution
        List<String> restricted = ticketIdsForFilter.resolve(ADMIN, filter);

        // verifications
        assertThat(restricted).containsExactly("t-2");
    }

    @Test
    void resolveExcluded_hasPendingApprovalFalse_ticketsWaitingOnApprovalExcluded() {
        // setup
        when(pendingApprovalProvider.getIfAvailable()).thenReturn(approvalProvider);
        when(approvalProvider.ticketIdsWithPendingApproval()).thenReturn(List.of("t-1"));
        TicketFilterInput filter = TicketFilterInput.builder().hasPendingApproval(false).build();

        // execution
        List<String> excluded = ticketIdsForFilter.resolveExcluded(filter);

        // verifications
        assertThat(excluded).containsExactly("t-1");
    }

    @Test
    void resolveExcluded_noApprovalFilter_nothingExcluded() {
        // setup
        TicketFilterInput filter = TicketFilterInput.builder().hasPendingApproval(true).build();

        // execution
        List<String> excluded = ticketIdsForFilter.resolveExcluded(filter);

        // verifications
        assertThat(excluded).isNull();
        verifyNoInteractions(pendingApprovalProvider);
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

    private TicketFilterInput unreadOnly() {
        TicketFilterInput filter = new TicketFilterInput();
        filter.setHasUnreadNotifications(true);
        return filter;
    }
}
