package com.openframe.client.service;

import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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

class SoftwareScheduleFireDispatcherTest {

    private static final String TENANT = "t-1";

    private final ScriptRepository scriptRepository = mock(ScriptRepository.class);
    private final PackageManagerRegistry registry =
            new PackageManagerRegistry(List.of(new BrewPackageManagerHandler(), new WingetPackageManagerHandler()));
    private final ScriptExecutionRepository scriptExecutionRepository = mock(ScriptExecutionRepository.class);
    private final SoftwareNatsPublisher softwareNatsPublisher = mock(SoftwareNatsPublisher.class);
    private final ScriptDeliveryRetryStore retryStore = mock(ScriptDeliveryRetryStore.class);
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
    private final MachinePlatformResolver platformResolver = new MachinePlatformResolver(machineRepository, tenantIdProvider);

    private final SoftwareScheduleFireDispatcher dispatcher = new SoftwareScheduleFireDispatcher(
            scriptRepository, registry, scriptExecutionRepository, softwareNatsPublisher, retryStore, platformResolver);

    @Test
    @DisplayName("fires a brew install to its macOS targets: QUEUED rows, one software-pipe message per machine, each armed for SOFTWARE-channel retry")
    void dispatch_fansOutQueuedSoftware() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", OsType.MAC_OS), machine("m-2", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(brewScript()));

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
        assertThat(req.getMachineIds()).containsExactly("m-1", "m-2");
        assertThat(req.getSource()).isEqualTo(ExecutionSource.SCHEDULED);
        assertThat(req.getPackageName()).isEqualTo("slack");
        String executionId = req.getExecutionId();

        ArgumentCaptor<ScriptMessage> msgs = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(softwareNatsPublisher, times(2)).publishSoftware(any(), msgs.capture());
        assertThat(msgs.getAllValues()).allSatisfy(m -> assertThat(m.getArgs()).containsExactly("--cask", "slack"));
        verify(retryStore).store(eq(executionId), eq("m-1"), eq(DeliveryChannel.SOFTWARE), any());
        verify(retryStore).store(eq(executionId), eq("m-2"), eq(DeliveryChannel.SOFTWARE), any());
    }

    @Test
    @DisplayName("mixed brew+winget schedule routes each package to its own OS — brew→macOS, winget→Windows")
    void dispatch_mixedOs_routesPerPackage() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-mac", OsType.MAC_OS), machine("m-win", OsType.WINDOWS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__brew-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("brew-install-id", OsType.MAC_OS)));
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT, "__software__winget-install", ScriptType.SOFTWARE))
                .thenReturn(Optional.of(script("winget-install-id", OsType.WINDOWS)));

        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).createdBy("user-1").action(SoftwareAction.INSTALL)
                .packages(List.of(
                        SoftwareSchedulePackage.builder().packageManager(PackageManagerType.BREW).packageName("slack").brewPackageType(BrewPackageType.CASK).build(),
                        SoftwareSchedulePackage.builder().packageManager(PackageManagerType.WINGET).packageName("vscode").build()))
                .build();

        dispatcher.dispatch(schedule, List.of("m-mac", "m-win"), Instant.now());

        ArgumentCaptor<RunningExecutionRows> rows = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository, times(2)).saveQueued(rows.capture());
        RunningExecutionRows brew = rowFor(rows.getAllValues(), "slack");
        RunningExecutionRows winget = rowFor(rows.getAllValues(), "vscode");
        assertThat(brew.getMachineIds()).containsExactly("m-mac");   // brew only to macOS
        assertThat(winget.getMachineIds()).containsExactly("m-win"); // winget only to Windows

        verify(softwareNatsPublisher).publishSoftware(eq("m-mac"), any());
        verify(softwareNatsPublisher).publishSoftware(eq("m-win"), any());
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

    private static RunningExecutionRows rowFor(List<RunningExecutionRows> rows, String packageName) {
        return rows.stream().filter(r -> packageName.equals(r.getPackageName())).findFirst().orElseThrow();
    }

    private static Script brewScript() {
        return script("brew-install-id", OsType.MAC_OS);
    }

    private static Script script(String id, OsType supported) {
        return Script.builder()
                .id(id).type(ScriptType.SOFTWARE)
                .scriptBody("run \"$@\"").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).defaultTimeoutSeconds(1800)
                .supportedPlatforms(List.of(supported))
                .build();
    }

    private static Machine machine(String machineId, OsType osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setOsType(osType);
        return m;
    }
}
