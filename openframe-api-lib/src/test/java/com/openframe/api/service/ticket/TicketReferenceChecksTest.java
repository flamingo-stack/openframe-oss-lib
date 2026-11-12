package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.exception.ticket.TicketNotFoundException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketReferenceChecksTest {

    private static final String DEVICE_ID = "device-1";
    private static final String ORGANIZATION_ID = "organization-1";
    private static final String ASSIGNEE_ID = "user-1";

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private TicketService service;

    @Test
    void requireCreationReferences_inferredOrganizationAndAssignee_existWithoutCreatingTicket() {
        // setup
        Machine machine = new Machine();
        machine.setOrganizationId(ORGANIZATION_ID);
        when(machineRepository.findByMachineId(DEVICE_ID)).thenReturn(Optional.of(machine));
        when(organizationRepository.findByOrganizationId(ORGANIZATION_ID)).thenReturn(Optional.of(new Organization()));
        when(userRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(new User()));
        CreateTicketInput input = CreateTicketInput.builder().deviceId(DEVICE_ID).assigneeId(ASSIGNEE_ID).build();

        // execution
        Throwable failure = catchThrowable(() -> service.requireCreationReferences(input));

        // verifications
        assertThat(failure).isNull();
        verifyNoInteractions(ticketRepository, ticketNumberService);
    }

    @Test
    void requireCreationReferences_missingInferredOrganization_rejectsWithoutCreatingTicket() {
        // setup
        Machine machine = new Machine();
        machine.setOrganizationId(ORGANIZATION_ID);
        when(machineRepository.findByMachineId(DEVICE_ID)).thenReturn(Optional.of(machine));
        CreateTicketInput input = CreateTicketInput.builder().deviceId(DEVICE_ID).build();

        // execution
        Throwable failure = catchThrowable(() -> service.requireCreationReferences(input));

        // verifications
        assertThat(failure).isInstanceOf(NotFoundException.class).hasMessageContaining(ORGANIZATION_ID);
        verifyNoInteractions(ticketRepository, ticketNumberService, userRepository);
    }

    @Test
    void requireCreationReferences_missingDevice_rejectsWithoutCreatingTicket() {
        // setup
        CreateTicketInput input = CreateTicketInput.builder().deviceId(DEVICE_ID).build();

        // execution
        Throwable failure = catchThrowable(() -> service.requireCreationReferences(input));

        // verifications
        assertThat(failure).isInstanceOf(DeviceNotFoundException.class).hasMessageContaining(DEVICE_ID);
        verifyNoInteractions(ticketRepository, ticketNumberService, organizationRepository, userRepository);
    }

    @Test
    void requireCreationReferences_noOptionalReferences_performsNoLookups() {
        // setup
        CreateTicketInput input = new CreateTicketInput();

        // execution
        service.requireCreationReferences(input);

        // verifications
        verifyNoInteractions(ticketRepository, ticketNumberService, machineRepository, organizationRepository, userRepository);
    }

    @Test
    void getById_missingTicket_preservesDomainFailure() {
        // setup
        String ticketId = "missing-ticket";

        // execution
        Throwable failure = catchThrowable(() -> service.getById(ticketId));

        // verifications
        assertThat(failure).isInstanceOf(TicketNotFoundException.class);
        verifyNoInteractions(ticketNumberService);
    }
}
