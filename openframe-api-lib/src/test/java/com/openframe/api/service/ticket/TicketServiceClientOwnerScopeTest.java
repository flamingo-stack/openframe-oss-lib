package com.openframe.api.service.ticket;

import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.device.ClientOwnerScopeResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A device sees only the tickets it owns under its current organization. A ticket created while the
 * machine belonged to another customer is not found, exactly like another machine's ticket; a ticket
 * written before the owner snapshot existed stays visible.
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceClientOwnerScopeTest {

    private static final AuthPrincipal AGENT = AuthPrincipal.builder().machineId("machine-1").actorType(ActorType.AGENT).build();
    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
    private static final ClientOwnerScope UNDER_ORG_B = new ClientOwnerScope("machine-1", "org-b");

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private TicketStalenessResolver ticketStalenessResolver;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssignmentService assignmentService;
    @Mock private TicketLifecycleService ticketLifecycleService;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private ClientOwnerScopeResolver clientOwnerScopeResolver;

    @InjectMocks private TicketService service;

    @Test
    void getTicket_agentAndTicketCreatedUnderCurrentOrganization_found() {
        // setup
        when(clientOwnerScopeResolver.resolve(AGENT)).thenReturn(Optional.of(UNDER_ORG_B));
        Ticket ticket = ownedBy("machine-1", "org-b");
        when(ticketRepository.findByIdAndOwnerMachineId("t-1", "machine-1")).thenReturn(Optional.of(ticket));

        // execution
        Optional<Ticket> found = service.getTicket(AGENT, "t-1");

        // verifications
        assertThat(found).contains(ticket);
    }

    @Test
    void getTicket_agentAndTicketCreatedUnderPreviousOrganization_notFound() {
        // setup
        when(clientOwnerScopeResolver.resolve(AGENT)).thenReturn(Optional.of(UNDER_ORG_B));
        when(ticketRepository.findByIdAndOwnerMachineId("t-1", "machine-1"))
                .thenReturn(Optional.of(ownedBy("machine-1", "org-a")));

        // execution
        Optional<Ticket> found = service.getTicket(AGENT, "t-1");

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void getTicket_agentAndTicketWithoutSnapshot_stillFound() {
        // setup
        when(clientOwnerScopeResolver.resolve(AGENT)).thenReturn(Optional.of(UNDER_ORG_B));
        Ticket legacy = ownedBy("machine-1", null);
        when(ticketRepository.findByIdAndOwnerMachineId("t-1", "machine-1")).thenReturn(Optional.of(legacy));

        // execution
        Optional<Ticket> found = service.getTicket(AGENT, "t-1");

        // verifications
        assertThat(found).contains(legacy);
    }

    @Test
    void getTicketByNumber_agentAndTicketCreatedUnderPreviousOrganization_notFound() {
        // setup
        when(clientOwnerScopeResolver.resolve(AGENT)).thenReturn(Optional.of(UNDER_ORG_B));
        when(ticketRepository.findByTicketNumberAndOwnerMachineId(42, "machine-1"))
                .thenReturn(Optional.of(ownedBy("machine-1", "org-a")));

        // execution
        Optional<Ticket> found = service.getTicketByNumber(AGENT, 42);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void getTicket_admin_unscopedLookup() {
        // setup
        when(clientOwnerScopeResolver.resolve(ADMIN)).thenReturn(Optional.empty());
        Ticket ticket = ownedBy("machine-1", "org-a");
        when(ticketRepository.findById("t-1")).thenReturn(Optional.of(ticket));

        // execution
        Optional<Ticket> found = service.getTicket(ADMIN, "t-1");

        // verifications
        assertThat(found).contains(ticket);
    }

    @Test
    void createTicketFromDialog_agent_ownerSnapshotsTheMachinesCurrentOrganization() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setHostname("host-1");
        machine.setOrganizationId("org-b");
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.of(machine));
        Organization organization = new Organization();
        organization.setOrganizationId("org-b");
        organization.setName("Customer B");
        when(organizationRepository.findByOrganizationId("org-b")).thenReturn(Optional.of(organization));
        when(ticketNumberService.getNextTicketNumber()).thenReturn(7);
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // execution
        Ticket created = service.createTicketFromDialog(AGENT);

        // verifications
        assertThat(created.getOwner()).isEqualTo(new ClientTicketOwner("machine-1", "org-b"));
        assertThat(created.getDeviceId()).isEqualTo("machine-1");
        assertThat(created.getOrganizationId()).isEqualTo("org-b");
        verify(ticketRepository).save(created);
    }

    private static Ticket ownedBy(String machineId, String organizationId) {
        return Ticket.builder().id("t-1").owner(new ClientTicketOwner(machineId, organizationId)).build();
    }
}
