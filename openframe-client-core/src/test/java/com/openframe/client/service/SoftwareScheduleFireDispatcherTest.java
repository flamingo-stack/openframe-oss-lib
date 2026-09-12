package com.openframe.client.service;

import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class SoftwareScheduleFireDispatcherTest {

    private static final String TENANT = "t-1";

    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final PackageManagerRegistry registry = new PackageManagerRegistry(List.of(new BrewPackageManagerHandler()));
    private final ScriptExecutionRepository scriptExecutionRepository = mock(ScriptExecutionRepository.class);
    private final SoftwareNatsPublisher softwareNatsPublisher = mock(SoftwareNatsPublisher.class);
    private final ScriptDeliveryRetryStore retryStore = mock(ScriptDeliveryRetryStore.class);

    private final SoftwareScheduleFireDispatcher dispatcher = new SoftwareScheduleFireDispatcher(
            scriptRepository, registry, scriptExecutionRepository, softwareNatsPublisher, retryStore);

    @Test
    @DisplayName("fires a brew install: QUEUED rows with package identity, one software-pipe message per machine, each armed for SOFTWARE-channel retry")
    void dispatch_fansOutQueuedSoftware() {
        Script script = Script.builder()
                .id("brew-install-id").type(ScriptType.SOFTWARE)
                .scriptBody("brew install \"$@\"").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).defaultTimeoutSeconds(1800)
                .build();
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script));

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK)
                        .build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-1", "m-2"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(rows.capture());
        RunningExecutionRows req = rows.getValue();
        assertThat(req.getTenantId()).isEqualTo(TENANT);
        assertThat(req.getScriptId()).isEqualTo("brew-install-id");
        assertThat(req.getMachineIds()).containsExactly("m-1", "m-2");
        assertThat(req.getSource()).isEqualTo(ExecutionSource.SCHEDULED);
        assertThat(req.getPackageManager()).isEqualTo(PackageManagerType.BREW);
        assertThat(req.getPackageName()).isEqualTo("slack");
        assertThat(req.getSoftwareAction()).isEqualTo(SoftwareAction.INSTALL);
        String executionId = req.getExecutionId();
        assertThat(executionId).isNotBlank();

        ArgumentCaptor<ScriptMessage> msgs = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(softwareNatsPublisher, times(2)).publishSoftware(any(), msgs.capture());
        assertThat(msgs.getAllValues()).allSatisfy(m -> {
            assertThat(m.getExecutionId()).isEqualTo(executionId);
            assertThat(m.getScriptId()).isEqualTo("brew-install-id");
            assertThat(m.getArgs()).containsExactly("--cask", "slack");
        });

        verify(retryStore).store(eq(executionId), eq("m-1"), eq(DeliveryChannel.SOFTWARE), any());
        verify(retryStore).store(eq(executionId), eq("m-2"), eq(DeliveryChannel.SOFTWARE), any());
    }

    @Test
    @DisplayName("no target machines → nothing dispatched")
    void dispatch_noMachines_noop() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).action(SoftwareAction.INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK).build()))
                .build();

        dispatcher.dispatch(schedule, List.of(), Instant.now());

        verify(scriptExecutionRepository, times(0)).saveQueued(any());
        verify(softwareNatsPublisher, times(0)).publishSoftware(any(), any());
    }
}
