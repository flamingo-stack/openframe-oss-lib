package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketServiceDeviceNameTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String HOSTNAME = "DESKTOP-01";
    private static final String NICKNAME = "Reception desk";

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssignmentService assignmentService;
    @Mock private TicketLifecycleService ticketLifecycleService;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private TicketStalenessResolver ticketStalenessResolver;
    @Spy private List<TicketEventListener> listeners = new ArrayList<>();

    @InjectMocks private TicketService service;

    private final AuthPrincipal admin = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
    private final AuthPrincipal agent = AuthPrincipal.builder().id("agent-1").actorType(ActorType.AGENT)
            .machineId(MACHINE_ID).build();

    @BeforeEach
    void setUp() {
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ticketNumberService.getNextTicketNumber()).thenReturn(7);
    }

    @Test
    void anAdminTicket_forANicknamedDevice_showsTheNickname() {
        // setup
        givenMachine(NICKNAME);

        // execution
        service.createTicket(admin, inputForDevice());

        // verifications
        assertThat(savedTicket().getDeviceHostname()).isEqualTo(NICKNAME);
    }

    @Test
    void anAdminTicket_forADeviceWithoutANickname_showsTheHostname() {
        // setup
        givenMachine(null);

        // execution
        service.createTicket(admin, inputForDevice());

        // verifications
        assertThat(savedTicket().getDeviceHostname()).isEqualTo(HOSTNAME);
    }

    @Test
    void anAgentTicket_takesTheNicknameOfItsOwnDevice() {
        // setup
        givenMachine(NICKNAME);

        // execution
        service.createTicket(agent, CreateTicketInput.builder().title("Printer is offline").build());

        // verifications
        assertThat(savedTicket().getDeviceHostname()).isEqualTo(NICKNAME);
    }

    private void givenMachine(String nickname) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname(HOSTNAME);
        machine.setNickname(nickname);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private static CreateTicketInput inputForDevice() {
        return CreateTicketInput.builder().title("Printer is offline").deviceId(MACHINE_ID).build();
    }

    private Ticket savedTicket() {
        ArgumentCaptor<Ticket> saved = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository).save(saved.capture());
        return saved.getValue();
    }
}
