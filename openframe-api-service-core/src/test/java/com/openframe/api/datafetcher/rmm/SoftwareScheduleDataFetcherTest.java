package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.PackageUpdateSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareAutoUpdateInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.rmm.software.PackageUpdateMode.WAIT;
import static com.openframe.data.document.rmm.software.SoftwareAction.UPDATE;
import static com.openframe.graphql.relay.NodeType.MACHINE;
import static com.openframe.graphql.relay.NodeType.SOFTWARE_SCHEDULE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleDataFetcherTest {

    private static final AuthPrincipal TECHNICIAN = AuthPrincipal.builder().id("user-1").build();
    private static final String NAME = "Nightly browser updates";
    private static final String NAME_TAKEN = "Software schedule with name 'Nightly browser updates' already exists";
    private static final Instant START_AT = Instant.parse("2026-11-23T09:30:00Z");
    private static final long DAILY = 86_400L;
    private static final List<String> GLOBAL_MACHINE_IDS = List.of("gid-machine-1");
    private static final List<String> RAW_MACHINE_IDS = List.of("machine-1");

    @Mock private SoftwareScheduleService scheduleService;
    @Mock private DeviceService deviceService;
    @Mock private GraphQLDeviceMapper deviceMapper;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private RelayIdCodec relayIdCodec;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createSoftwareSchedule_refused_keepsEverythingAsked() {
        decodesTheMachineIds();
        when(scheduleService.create(createInput(RAW_MACHINE_IDS, waitAnHour()), "user-1"))
                .thenThrow(new ConflictException(NAME_TAKEN));
        SoftwareScheduleDataFetcher fetcher = auditedFetcher();
        CreateSoftwareScheduleInput input = createInput(GLOBAL_MACHINE_IDS, waitAnHour());

        assertThatThrownBy(() -> fetcher.createSoftwareSchedule(input, TECHNICIAN))
                .isInstanceOf(ConflictException.class)
                .hasMessage(NAME_TAKEN);
        assertThat(recordedDetails(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "machineIds", RAW_MACHINE_IDS, "softwareAction", UPDATE, "packages", List.of("firefox", "software-7"),
                "startAt", START_AT, "repeat", DAILY, "updateMode", WAIT, "deadlineSeconds", 3_600L,
                "countdownSeconds", 300, "autoUpdate", true));
    }

    @Test
    void createSoftwareSchedule_createdWithoutUpdateSettings_keepsTheSettingsTheScheduleWasSavedWith() {
        decodesTheMachineIds();
        PackageUpdateSettings defaults = PackageUpdateSettings.builder()
                .mode(WAIT).deadlineSeconds(604_800L).countdownSeconds(300).build();
        SoftwareScheduleResponse created =
                SoftwareScheduleResponse.builder().id("schedule-1").updateSettings(defaults).build();
        when(scheduleService.create(createInput(RAW_MACHINE_IDS, null), "user-1")).thenReturn(created);

        SoftwareScheduleResponse returned =
                auditedFetcher().createSoftwareSchedule(createInput(GLOBAL_MACHINE_IDS, null), TECHNICIAN);

        assertThat(recordedDetails(returned))
                .containsEntry("updateMode", WAIT)
                .containsEntry("deadlineSeconds", 604_800L)
                .containsEntry("countdownSeconds", 300);
    }

    @Test
    void updateSoftwareSchedule_refused_keepsEverythingAsked() {
        decodesTheScheduleAndMachineIds();
        when(scheduleService.update(updateInput("schedule-1", RAW_MACHINE_IDS), "user-1"))
                .thenThrow(new ConflictException(NAME_TAKEN));
        SoftwareScheduleDataFetcher fetcher = auditedFetcher();
        UpdateSoftwareScheduleInput input = updateInput("gid-schedule-1", GLOBAL_MACHINE_IDS);

        assertThatThrownBy(() -> fetcher.updateSoftwareSchedule(input, TECHNICIAN))
                .isInstanceOf(ConflictException.class)
                .hasMessage(NAME_TAKEN);
        assertThat(recordedDetails(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "name", NAME, "startAt", START_AT, "repeat", DAILY, "softwareAction", UPDATE,
                "packages", List.of("firefox", "software-7"), "machineIds", RAW_MACHINE_IDS, "updateMode", WAIT,
                "deadlineSeconds", 3_600L, "countdownSeconds", 300, "autoUpdate", true));
    }

    @Test
    void updateSoftwareSchedule_refusedWithoutUpdateSettingsOrAutoUpdate_keepsNoneOfThem() {
        decodesTheScheduleAndMachineIds();
        when(scheduleService.update(withoutSettings(updateInput("schedule-1", RAW_MACHINE_IDS)), "user-1"))
                .thenThrow(new ConflictException(NAME_TAKEN));
        SoftwareScheduleDataFetcher fetcher = auditedFetcher();
        UpdateSoftwareScheduleInput input = withoutSettings(updateInput("gid-schedule-1", GLOBAL_MACHINE_IDS));

        assertThatThrownBy(() -> fetcher.updateSoftwareSchedule(input, TECHNICIAN))
                .isInstanceOf(ConflictException.class)
                .hasMessage(NAME_TAKEN);
        assertThat(recordedDetails(null))
                .containsEntry("updateMode", null)
                .containsEntry("deadlineSeconds", null)
                .containsEntry("countdownSeconds", null)
                .containsEntry("autoUpdate", null);
    }

    @Test
    void updateSoftwareSchedule_updated_leavesTheAskedValuesToTheChanges() {
        decodesTheScheduleAndMachineIds();
        SoftwareScheduleResponse updated = SoftwareScheduleResponse.builder().id("schedule-1").build();
        when(scheduleService.update(updateInput("schedule-1", RAW_MACHINE_IDS), "user-1")).thenReturn(updated);

        SoftwareScheduleResponse returned =
                auditedFetcher().updateSoftwareSchedule(updateInput("gid-schedule-1", GLOBAL_MACHINE_IDS), TECHNICIAN);

        assertThat(recordedDetails(returned).values()).containsOnlyNulls();
    }

    private SoftwareScheduleDataFetcher auditedFetcher() {
        when(auditedMethodRunner.run(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
        SoftwareScheduleDataFetcher fetcher = new SoftwareScheduleDataFetcher(scheduleService, deviceService,
                deviceMapper, packageManagerAvailability, relayIdCodec);
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(fetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private Map<String, Object> recordedDetails(SoftwareScheduleResponse result) {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue().detailsFromResult().apply(result);
    }

    private void decodesTheMachineIds() {
        when(relayIdCodec.decodeAll(GLOBAL_MACHINE_IDS, MACHINE)).thenReturn(RAW_MACHINE_IDS);
    }

    private void decodesTheScheduleAndMachineIds() {
        when(relayIdCodec.decode("gid-schedule-1", SOFTWARE_SCHEDULE)).thenReturn("schedule-1");
        decodesTheMachineIds();
    }

    private static CreateSoftwareScheduleInput createInput(List<String> machineIds,
                                                           PackageUpdateSettingsInput updateSettings) {
        CreateSoftwareScheduleInput input = new CreateSoftwareScheduleInput();
        input.setName(NAME);
        input.setAction(UPDATE);
        input.setPackages(packages());
        input.setStartAt(START_AT);
        input.setRepeat(DAILY);
        input.setMachineIds(machineIds);
        input.setUpdateSettings(updateSettings);
        input.setAutoUpdate(autoUpdateOn());
        return input;
    }

    private static UpdateSoftwareScheduleInput updateInput(String id, List<String> machineIds) {
        UpdateSoftwareScheduleInput input = new UpdateSoftwareScheduleInput();
        input.setId(id);
        input.setName(NAME);
        input.setAction(UPDATE);
        input.setPackages(packages());
        input.setStartAt(START_AT);
        input.setRepeat(DAILY);
        input.setMachineIds(machineIds);
        input.setUpdateSettings(waitAnHour());
        input.setAutoUpdate(autoUpdateOn());
        return input;
    }

    private static UpdateSoftwareScheduleInput withoutSettings(UpdateSoftwareScheduleInput input) {
        input.setUpdateSettings(null);
        input.setAutoUpdate(null);
        return input;
    }

    private static List<SoftwareSchedulePackageInput> packages() {
        SoftwareSchedulePackageInput named = new SoftwareSchedulePackageInput();
        named.setPackageName("firefox");
        SoftwareSchedulePackageInput fromInventory = new SoftwareSchedulePackageInput();
        fromInventory.setSoftwareId("software-7");
        return List.of(named, fromInventory);
    }

    private static PackageUpdateSettingsInput waitAnHour() {
        PackageUpdateSettingsInput settings = new PackageUpdateSettingsInput();
        settings.setMode(WAIT);
        settings.setDeadlineSeconds(3_600L);
        settings.setCountdownSeconds(300);
        return settings;
    }

    private static SoftwareAutoUpdateInput autoUpdateOn() {
        SoftwareAutoUpdateInput autoUpdate = new SoftwareAutoUpdateInput();
        autoUpdate.setEnabled(true);
        return autoUpdate;
    }
}
