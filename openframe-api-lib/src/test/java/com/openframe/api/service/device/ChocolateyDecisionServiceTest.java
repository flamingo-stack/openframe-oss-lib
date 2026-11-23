package com.openframe.api.service.device;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.device.chocolatey.ChocolateyDecision;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChocolateyDecisionServiceTest {

    private static final String TENANT = "t1";
    private static final String MACHINE_ID = "machine-1";
    private static final String DECIDED_BY = "user-1";
    private static final String PINNED = "PINNED";
    private static final String UPGRADE_BLOCKED = "UPGRADE_BLOCKED";
    private static final String VERSION_1 = "VERSION_1";

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private TenantIdProvider tenantIdProvider;

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks private ChocolateyDecisionService service;

    private Machine machine;
    private Machine updated;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId(TENANT);
        updated = new Machine();
        updated.setMachineId(MACHINE_ID);
        updated.setTenantId(TENANT);
        updated.setNickname("after the write");
    }

    @Test
    void set_unknownMachine_notFoundNothingWritten() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        NotFoundException notFound = assertThrows(NotFoundException.class,
                () -> service.set(MACHINE_ID, ChocolateyAdminOption.DONT_TOUCH, DECIDED_BY));

        // verifications
        assertThat(notFound.getMessage()).contains(MACHINE_ID);
        verifyNoInteractions(machineWriter);
    }

    @Test
    void set_machineOfTheTenant_lookedUpWithTheTenantIdOfTheProvider() {
        // setup
        machine.setChocolatey(chocolatey(ChocolateyStatus.ACTION_REQUIRED, PINNED));
        stubMachine();
        stubWrite();

        // execution
        service.set(MACHINE_ID, ChocolateyAdminOption.DONT_TOUCH, DECIDED_BY);

        // verifications
        verify(machineRepository).findByTenantIdAndMachineId(TENANT, MACHINE_ID);
        verify(machineRepository, never()).findByMachineId(MACHINE_ID);
    }

    @Test
    void set_noChocolateyReported_badRequestNothingWritten() {
        // setup
        machine.setChocolatey(null);
        stubMachine();

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> service.set(MACHINE_ID, ChocolateyAdminOption.ADMIN_FIXES, DECIDED_BY));

        // verifications
        assertThat(refused.getMessage()).isNotBlank();
        verifyNoInteractions(machineWriter);
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ChocolateyStatus.class, names = {"ACTION_REQUIRED"}, mode = EnumSource.Mode.EXCLUDE)
    void set_statusNotActionRequired_badRequestNothingWritten(ChocolateyStatus status) {
        // setup
        machine.setChocolatey(chocolatey(status, null));
        stubMachine();

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> service.set(MACHINE_ID, ChocolateyAdminOption.ADMIN_FIXES, DECIDED_BY));

        // verifications
        assertThat(refused.getMessage()).isNotBlank();
        verifyNoInteractions(machineWriter);
    }

    @ParameterizedTest
    @EnumSource(ChocolateyAdminOption.class)
    void set_actionRequired_oneDecisionFieldWrittenWithTheOptionTheReportedReasonAndTheActor(ChocolateyAdminOption option) {
        // setup
        machine.setChocolatey(chocolatey(ChocolateyStatus.ACTION_REQUIRED, PINNED));
        stubMachine();
        stubWrite();
        Instant before = Instant.now();

        // execution
        service.set(MACHINE_ID, option, DECIDED_BY);

        // verifications
        Instant after = Instant.now();
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("chocolateyDecision");
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolateyDecision())
                .extracting(ChocolateyDecision::getOption, ChocolateyDecision::getReason, ChocolateyDecision::getDecidedBy)
                .containsExactly(option, PINNED, DECIDED_BY);
        assertThat(applied.getChocolateyDecision().getDecidedAt()).isBetween(before, after);
    }

    @Test
    void set_actionRequired_chocolateyObjectItselfIsNotRewritten() {
        // setup
        machine.setChocolatey(chocolatey(ChocolateyStatus.ACTION_REQUIRED, PINNED));
        stubMachine();
        stubWrite();

        // execution
        service.set(MACHINE_ID, ChocolateyAdminOption.DONT_TOUCH, DECIDED_BY);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolatey()).isNull();
    }

    @Test
    void set_actionRequired_machineAfterTheWriteReturned() {
        // setup
        machine.setChocolatey(chocolatey(ChocolateyStatus.ACTION_REQUIRED, PINNED));
        stubMachine();
        stubWrite();

        // execution
        Machine result = service.set(MACHINE_ID, ChocolateyAdminOption.DONT_TOUCH, DECIDED_BY);

        // verifications
        assertThat(result).isSameAs(updated);
    }

    @ParameterizedTest
    @MethodSource("optionsReasonsAndRetry")
    void set_optionOnAReason_upgradeRetryPendingOnlyForAdminFixesOnUpgradeBlocked(
            ChocolateyAdminOption option, String reason, boolean expectedRetryPending) {
        // setup
        machine.setChocolatey(chocolatey(ChocolateyStatus.ACTION_REQUIRED, reason));
        stubMachine();
        stubWrite();

        // execution
        service.set(MACHINE_ID, option, DECIDED_BY);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolateyDecision())
                .extracting(ChocolateyDecision::getOption, ChocolateyDecision::getReason,
                        ChocolateyDecision::isUpgradeRetryPending)
                .containsExactly(option, reason, expectedRetryPending);
    }

    private static Stream<Arguments> optionsReasonsAndRetry() {
        return Stream.of(
                Arguments.of(ChocolateyAdminOption.ADMIN_FIXES, UPGRADE_BLOCKED, true),
                Arguments.of(ChocolateyAdminOption.DONT_TOUCH, UPGRADE_BLOCKED, false),
                Arguments.of(ChocolateyAdminOption.ADMIN_FIXES, VERSION_1, false),
                Arguments.of(ChocolateyAdminOption.DONT_TOUCH, VERSION_1, false),
                Arguments.of(ChocolateyAdminOption.ADMIN_FIXES, "upgrade_blocked", false),
                Arguments.of(ChocolateyAdminOption.ADMIN_FIXES, null, false));
    }

    private void stubMachine() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private void stubWrite() {
        MachineWriteResult written = new MachineWriteResult(machine, updated);
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenReturn(Optional.of(written));
    }

    private static MachineChocolatey chocolatey(ChocolateyStatus status, String reason) {
        return MachineChocolatey.builder()
                .version("1.4.0")
                .edition("OPEN_SOURCE")
                .ours(false)
                .status(status)
                .reason(reason)
                .packages(List.of())
                .existingPackages(List.of("7zip"))
                .build();
    }
}
