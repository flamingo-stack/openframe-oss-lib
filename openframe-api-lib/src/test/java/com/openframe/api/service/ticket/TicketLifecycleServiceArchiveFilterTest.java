package com.openframe.api.service.ticket;

import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.TICKET_STATUS_CHANGE;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
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
    private List<Ticket> resolvedTickets = List.of();

    private final AuditedMethodRunner auditedMethodRunner = mock(AuditedMethodRunner.class, CALLS_REAL_METHODS);
    private final AuditRecorder auditRecorder = mock(AuditRecorder.class);

    private TicketLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new TicketLifecycleService(ticketRepository, statusRepository, transitionPolicy,
                tenantIdProvider, ticketTagService, ticketIdsForFilter, ticketResolverStamp,
                historyService, List.of(listener), auditedMethodRunner, auditRecorder);
        when(statusRepository.findByKind(TicketStatusKind.RESOLVED)).thenReturn(Optional.of(resolved));
        when(statusRepository.findByKind(TicketStatusKind.ARCHIVED)).thenReturn(Optional.of(archived));
        when(ticketRepository.buildTicketQuery(any(), isNull(), any(), isNull())).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), anyInt(), any(), any()))
                .thenAnswer(_ -> resolvedTickets);
    }

    @Test
    void archiveResolvedTickets_ticketEditedAfterTheRead_recordedAsMongoArchivedIt() {
        resolvedTickets = List.of(resolvedTicket("t-1", "Printer offline"));
        Ticket asArchived = Ticket.builder().id("t-1").title("Printer offline on floor 2").organizationId("org-2")
                .deviceId("machine-2").statusId("st-resolved").statusKind(TicketStatusKind.RESOLVED).build();
        when(ticketRepository.moveFromStatus("t-1", "st-resolved", "st-archived", TicketStatusKind.ARCHIVED))
                .thenReturn(Optional.of(asArchived));

        List<String> archivedIds = service.archiveResolvedTickets(admin, null);

        assertThat(archivedIds).containsExactly("t-1");
        ArgumentCaptor<List<AuditEntry>> entries = ArgumentCaptor.captor();
        verify(auditRecorder).recordAllWithoutLoadingTargets(entries.capture());
        assertThat(entries.getValue()).singleElement()
                .returns(TICKET_STATUS_CHANGE, AuditEntry::getAction)
                .returns("t-1", AuditEntry::getTargetId)
                .returns("Printer offline on floor 2", AuditEntry::getTargetName)
                .returns("org-2", AuditEntry::getOrganizationId)
                .returns("machine-2", AuditEntry::getDeviceId)
                .returns(Map.of("statusId", new AuditChange("st-resolved", "st-archived"),
                        "statusKind", new AuditChange("RESOLVED", "ARCHIVED")), AuditEntry::getChanges);
    }

    @Test
    void archiveResolvedTickets_ticketReopenedAfterTheRead_neitherReturnedNorRecorded() {
        Ticket printer = resolvedTicket("t-1", "Printer offline");
        Ticket vpn = resolvedTicket("t-2", "VPN drops");
        resolvedTickets = List.of(printer, vpn);
        when(ticketRepository.moveFromStatus("t-1", "st-resolved", "st-archived", TicketStatusKind.ARCHIVED))
                .thenReturn(Optional.of(printer));
        when(ticketRepository.moveFromStatus("t-2", "st-resolved", "st-archived", TicketStatusKind.ARCHIVED))
                .thenReturn(Optional.empty());

        List<String> archivedIds = service.archiveResolvedTickets(admin, null);

        assertThat(archivedIds).containsExactly("t-1");
        ArgumentCaptor<List<AuditEntry>> entries = ArgumentCaptor.captor();
        verify(auditRecorder).recordAllWithoutLoadingTargets(entries.capture());
        assertThat(entries.getValue()).extracting(AuditEntry::getTargetId).containsExactly("t-1");
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

    @Test
    void archiveResolved_narrowsToTheRequestedCreationSources() {
        TicketFilterInput filter = TicketFilterInput.builder()
                .creationSources(List.of(TicketCreationSource.EMAIL))
                .build();

        service.archiveResolvedTickets(admin, filter);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getCreationSources()).containsExactly(TicketCreationSource.EMAIL);
        assertThat(captured.getStatusIds()).containsExactly(resolved.getId());
    }

    // guard: green before implementation
    @ParameterizedTest
    @NullAndEmptySource
    void archiveResolved_creationSourcesNullOrEmpty_noSourceNarrowing(List<TicketCreationSource> creationSources) {
        TicketFilterInput filter = TicketFilterInput.builder().creationSources(creationSources).build();

        service.archiveResolvedTickets(admin, filter);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getCreationSources()).isNullOrEmpty();
        assertThat(captured.getStatusIds()).containsExactly(resolved.getId());
    }

    // guard: green before implementation
    @Test
    void archiveResolved_withoutFilter_noSourceNarrowing() {
        service.archiveResolvedTickets(admin, null);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getCreationSources()).isNullOrEmpty();
        assertThat(captured.getStatusIds()).containsExactly(resolved.getId());
    }

    private TicketQueryFilter capturedFilter() {
        ArgumentCaptor<TicketQueryFilter> captor = ArgumentCaptor.forClass(TicketQueryFilter.class);
        verify(ticketRepository, atLeastOnce()).buildTicketQuery(captor.capture(), isNull(), any(), isNull());
        return captor.getValue();
    }

    private static Ticket resolvedTicket(String id, String title) {
        return Ticket.builder().id(id).title(title).organizationId("org-1").deviceId("machine-1")
                .statusId("st-resolved").statusKind(TicketStatusKind.RESOLVED).build();
    }

    private static TicketStatusDefinition definition(String id, TicketStatusKind kind) {
        return TicketStatusDefinition.builder().id(id).kind(kind).name(id).build();
    }
}
