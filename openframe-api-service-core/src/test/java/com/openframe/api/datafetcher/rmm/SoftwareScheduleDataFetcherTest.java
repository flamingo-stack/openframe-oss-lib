package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.PackageUpdateSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareAutoUpdateInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.rmm.software.PackageUpdateMode.WAIT;
import static com.openframe.data.document.rmm.software.SoftwareAction.UPDATE;
import static com.openframe.graphql.relay.NodeType.MACHINE;
import static com.openframe.graphql.relay.NodeType.SOFTWARE_SCHEDULE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleDataFetcherTest {

    private static final String SCHEDULE_ID = "schedule-1";
    private static final String ASSIGNED_MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String ASSIGNED_ROW = "65f1a2b3c4d5e6f708192a01";
    private static final String OTHER_ROW = "65f1a2b3c4d5e6f708192a02";
    private static final String CURSOR_ROW = "65f1a2b3c4d5e6f708192a3b";
    private static final String SEARCH = "mac";
    private static final int FIRST = 20;
    private static final int LAST = 5;
    private static final List<String> ASSIGNED_MACHINE_IDS = List.of(ASSIGNED_MACHINE_ID);
    private static final List<PackageManagerType> ENABLED_MANAGERS = List.of(PackageManagerType.BREW);
    private static final SortInput BY_HOSTNAME = SortInput.builder()
            .field("hostname").direction(SortDirection.DESC).build();
    private static final AuthPrincipal TECHNICIAN = AuthPrincipal.builder().id("user-1").build();
    private static final String NAME = "Nightly browser updates";
    private static final String NAME_TAKEN = "Software schedule with name 'Nightly browser updates' already exists";
    private static final Instant START_AT = Instant.parse("2026-11-23T09:30:00Z");
    private static final long DAILY = 86_400L;
    private static final List<String> GLOBAL_MACHINE_IDS = List.of("gid-machine-1");
    private static final List<String> RAW_MACHINE_IDS = List.of("machine-1");

    @Mock private SoftwareScheduleService scheduleService;
    @Mock private DeviceService deviceService;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private RelayIdCodec relayIdCodec;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Spy private GraphQLDeviceMapper deviceMapper = new GraphQLDeviceMapper();
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @InjectMocks private SoftwareScheduleDataFetcher dataFetcher;

    private SoftwareScheduleResponse schedule;

    @BeforeEach
    void setUp() {
        schedule = SoftwareScheduleResponse.builder().id(SCHEDULE_ID).build();
    }

    @Test
    void assignedDevices_lastAndBefore_theAssignedDeviceQueryGetsTheBackwardPage() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-c", CURSOR_ROW);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        DeviceFilterCriteria noFilter = deviceMapper.toDeviceFilterCriteria(null);
        String startCursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-b", ASSIGNED_ROW).encode();
        String endCursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-a", OTHER_ROW).encode();
        CountedGenericQueryResult<Machine> page = page(startCursor, endCursor);
        when(dfe.getSource()).thenReturn(schedule);
        when(scheduleService.getMachineIds(SCHEDULE_ID)).thenReturn(ASSIGNED_MACHINE_IDS);
        when(deviceService.queryAssignedDevices(ASSIGNED_MACHINE_IDS, noFilter, backwardPage, SEARCH, BY_HOSTNAME))
                .thenReturn(page);

        // execution
        CountedGenericConnection<GenericEdge<Machine>> result =
                dataFetcher.assignedDevices(dfe, null, FIRST, null, LAST, before, SEARCH, BY_HOSTNAME);

        // verifications
        assertThat(result.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
        assertThat(backwardPage)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(LAST, CursorPaginationCriteria::getLimit);
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
    }

    @Test
    void availableDevices_lastAndBeforeWithASort_thePickerQueryGetsTheBackwardPageAndTheSortIsLeftOut() {
        // setup
        KeysetCursor cursor = new KeysetCursor("bucket", Sort.Direction.ASC, "2", CURSOR_ROW);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        DeviceFilterCriteria manageableDevices = DeviceFilterCriteria.builder()
                .manageableByPackageManagers(ENABLED_MANAGERS).build();
        Set<String> assigned = Set.of(ASSIGNED_MACHINE_ID);
        String startCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "0", ASSIGNED_ROW).encode();
        String endCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "1", OTHER_ROW).encode();
        CountedGenericQueryResult<Machine> page = page(startCursor, endCursor);
        when(dfe.getSource()).thenReturn(schedule);
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(scheduleService.getMachineIds(SCHEDULE_ID)).thenReturn(ASSIGNED_MACHINE_IDS);
        when(deviceService.queryAvailableDevicesForSchedule(null, assigned, manageableDevices, backwardPage, SEARCH))
                .thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, FIRST, null, LAST, before, SEARCH, BY_HOSTNAME);

        // verifications
        assertThat(result.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
        assertThat(result.getEdges())
                .extracting(edge -> edge.getNode().getMachineId(), AvailableDeviceEdge::isAssigned)
                .containsExactly(tuple(ASSIGNED_MACHINE_ID, true), tuple(OTHER_MACHINE_ID, false));
        assertThat(backwardPage.isBackward()).isTrue();
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
        verify(deviceService).queryAvailableDevicesForSchedule(null, assigned, manageableDevices, backwardPage, SEARCH);
        verifyNoMoreInteractions(deviceService);
    }

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

    private static CountedGenericQueryResult<Machine> page(String startCursor, String endCursor) {
        Machine assigned = machine(ASSIGNED_MACHINE_ID, ASSIGNED_ROW);
        Machine other = machine(OTHER_MACHINE_ID, OTHER_ROW);
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).hasPreviousPage(false)
                .startCursor(startCursor).endCursor(endCursor).build();
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(assigned, other))
                .pageInfo(pageInfo)
                .filteredCount(2)
                .build();
    }

    private static Machine machine(String machineId, String id) {
        Machine machine = new Machine();
        machine.setId(id);
        machine.setMachineId(machineId);
        return machine;
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
