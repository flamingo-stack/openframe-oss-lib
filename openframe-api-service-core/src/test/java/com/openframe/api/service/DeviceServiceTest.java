package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.event.DeviceNicknameUpdatedEvent;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.audit.AuditRecorder;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.device.CustomMachineRepository;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.DeletedMachineCleanup.LifecycleChange;
import com.openframe.data.service.rmm.software.DeviceSoftwareConnectivitySync;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static com.openframe.data.document.rmm.script.OsType.MAC_OS;
import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final CursorPosition NO_POSITION = new CursorPosition.None();
    private static final String ROW_1 = "65f1a2b3c4d5e6f708192a01";
    private static final String ROW_2 = "65f1a2b3c4d5e6f708192a02";
    private static final String ROW_3 = "65f1a2b3c4d5e6f708192a03";
    private static final String ROW_4 = "65f1a2b3c4d5e6f708192a04";
    private static final String ROW_5 = "65f1a2b3c4d5e6f708192a05";
    private static final List<String> ROWS = List.of(ROW_1, ROW_2, ROW_3, ROW_4, ROW_5);
    private static final String HOSTNAME = "hostname";
    private static final String ASC = "ASC";
    private static final String KEYSET_PREFIX = "k1|";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final Instant LAST_SEEN = Instant.ofEpochMilli(1_700_000_000_000L);
    private static final long OUTDATED_VERSION_KEY = 1_000_005_000_009L;
    private static final List<String> ASSIGNED_MACHINE_IDS = List.of("m-1", "m-2");

    @Mock private MachineRepository machineRepository;
    @Mock private DeletedMachineCleanup deletedMachineCleanup;
    @Mock private AuditRecorder auditRecorder;
    @Mock private DeviceSoftwareConnectivitySync deviceSoftwareConnectivitySync;
    @Mock private MachineWriter machineWriter;
    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private DeviceStatusProcessor deviceStatusProcessor;
    @Mock private DeviceFilterOptionMapper deviceFilterOptionMapper;
    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Captor private ArgumentCaptor<MachineUpdate> statusUpdateCaptor;
    @Captor private ArgumentCaptor<MachineQueryFilter> machineQueryFilterCaptor;

    private final CustomMachineRepository cursorIssuer =
            new CustomMachineRepositoryImpl(mock(MongoTemplate.class), new ClientVersionThreshold("1.6.0"));

    private DeviceService service() {
        DeviceService s = new DeviceService(machineRepository, deletedMachineCleanup, auditRecorder,
                deviceSoftwareConnectivitySync,
                machineWriter, tagRepository, tagAssignmentRepository,
                deviceStatusProcessor, deviceFilterOptionMapper, tenantIdProvider,
                eventPublisher);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        lenient().when(machineRepository.countMachines(any(), any(MachineQueryFilter.class), any())).thenReturn(0L);
        lenient().when(machineRepository.findMachinesWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(), anyBoolean(), anyInt(), any(), any())).thenReturn(List.of());
        lenient().when(machineRepository.findAvailableForScheduleWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(), any(), anyBoolean(), anyInt())).thenReturn(List.of());
        lenient().when(machineRepository.findMachineIds(any(), any(MachineQueryFilter.class), any())).thenReturn(List.of());
        return s;
    }

    private MachineQueryFilter capturedFilter() {
        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).countMachines(any(), captor.capture(), any());
        return captor.getValue();
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        return m;
    }

    @Test
    @DisplayName("verifyDispatchable: an unknown machine throws DeviceNotFoundException")
    void verifyDispatchable_unknownMachine() {
        when(machineRepository.findByMachineId("m-x")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().verifyDispatchable("m-x"))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    @DisplayName("verifyDispatchable: a non-eligible machine (PENDING_DELETION) throws BadRequestException")
    void verifyDispatchable_nonEligibleMachine() {
        when(machineRepository.findByMachineId("m-x")).thenReturn(Optional.of(machine("m-x", DeviceStatus.PENDING_DELETION)));

        assertThatThrownBy(() -> service().verifyDispatchable("m-x"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("dispatchable state");
    }

    @Test
    @DisplayName("verifyDispatchable(list): ONLINE and OFFLINE machines both pass; every id is checked")
    void verifyDispatchable_eligibleMachines() {
        when(machineRepository.findByMachineId("m-on")).thenReturn(Optional.of(machine("m-on", DeviceStatus.ONLINE)));
        when(machineRepository.findByMachineId("m-off")).thenReturn(Optional.of(machine("m-off", DeviceStatus.OFFLINE)));

        service().verifyDispatchable(List.of("m-on", "m-off"));

        verify(machineRepository).findByMachineId("m-on");
        verify(machineRepository).findByMachineId("m-off");
    }

    @Test
    @DisplayName("queryAssignedDevices: restricts the filter to the given machineIds (repo turns this into machineId $in)")
    void scopesToMachineIds() {
        service().queryAssignedDevices(List.of("m1", "m2"), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getRestrictToMachineIds()).containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("queryAssignedDevices: empty machineId set → non-null empty restriction (repo turns this into a no-match query)")
    void emptySetYieldsNoResults() {
        service().queryAssignedDevices(List.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getRestrictToMachineIds()).isEmpty();
    }

    @Test
    @DisplayName("queryAssignedDevices: null machineId set treated as empty — non-null empty restriction, no results")
    void nullSetTreatedAsEmpty() {
        service().queryAssignedDevices(null, null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getRestrictToMachineIds()).isEmpty();
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: the platform scope lands on the filter's osTypes — repo expands to osType $in")
    void scopesToPlatforms() {
        service().queryDevicesForPlatforms(List.of(MAC_OS), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).containsExactly(MAC_OS);
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: empty platform scope → no osTypes constraint on the filter")
    void noPlatforms_noConstraint() {
        service().queryDevicesForPlatforms(List.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).isNullOrEmpty();
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: an explicit osType filter narrows within the scope (filter wins, single osTypes constraint)")
    void filterOsTypesNarrowScope() {
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .osTypes(List.of(WINDOWS)).build();

        service().queryDevicesForPlatforms(List.of(WINDOWS, MAC_OS), filter,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).containsExactly(WINDOWS);
    }

    @Test
    @DisplayName("queryDevices: the user's osType filter alone reaches the repo (no schedule scope)")
    void queryDevices_filterOsTypesOnly() {
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().osTypes(List.of(MAC_OS)).build();

        service().queryDevices(filter, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).containsExactly(MAC_OS);
    }

    @Test
    @DisplayName("queryDevices: the connectivity filter reaches the repo as telemetry status names")
    void queryDevices_connectivityFilter_mappedToNames() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().connectivity(List.of(TelemetryStatus.ONLINE)).build();

        // execution
        service().queryDevices(filter, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        // verifications
        assertThat(capturedFilter().getConnectivity()).containsExactly("ONLINE");
    }

    @Test
    @DisplayName("queryDevices: no connectivity filter → no connectivity constraint")
    void queryDevices_noConnectivityFilter_nullConnectivity() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().osTypes(List.of(MAC_OS)).build();

        // execution
        service().queryDevices(filter, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        // verifications
        assertThat(capturedFilter().getConnectivity()).isNull();
    }

    @Test
    @DisplayName("getAvailableDeviceFilters: the connectivity facet is computed once from Mongo next to status")
    void getAvailableDeviceFilters_computesConnectivityFacet() {
        // setup
        DeviceService s = service();

        // execution
        s.getAvailableDeviceFilters(List.of(MAC_OS), null, null);

        // verifications
        verify(machineRepository).facet(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(), eq(DeviceFacetDimension.CONNECTIVITY));
        verify(machineRepository).facet(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(), eq(DeviceFacetDimension.STATUS));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(booleans = {true, false})
    void queryDevices_clientOutdatedFilter_reachesTheRepoAsIs(Boolean clientOutdated) {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().clientOutdated(clientOutdated).build();

        // execution
        service().queryDevices(filter, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        // verifications
        assertThat(capturedFilter().getClientOutdated()).isEqualTo(clientOutdated);
    }

    @Test
    void getAvailableDeviceFilters_clientOutdatedFacet_computedFromMongo() {
        // setup
        DeviceService s = service();

        // execution
        s.getAvailableDeviceFilters(List.of(MAC_OS), null, null);

        // verifications
        verify(machineRepository).facet(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(DeviceFacetDimension.CLIENT_OUTDATED));
    }

    @Test
    @DisplayName("queryDevices: no filter and no scope → no osTypes constraint")
    void queryDevices_noFilterNoScope_noOsTypes() {
        service().queryDevices(null, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).isNullOrEmpty();
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: an empty osType filter is unconstrained → falls back to the schedule scope")
    void emptyFilterOsTypes_fallsBackToScope() {
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().osTypes(List.of()).build();

        service().queryDevicesForPlatforms(List.of(MAC_OS), filter,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getOsTypes()).containsExactly(MAC_OS);
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: delegates to repo.findMachineIds with a filter carrying the osTypes scope")
    void findDeviceIdsForPlatforms_returnsIds() {
        DeviceService s = service();
        when(machineRepository.findMachineIds(any(), any(MachineQueryFilter.class), any()))
                .thenReturn(List.of("m1", "m2"));

        List<String> ids = s.findDeviceIdsForPlatforms(List.of(MAC_OS), null, null);

        assertThat(ids).containsExactly("m1", "m2");
        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).findMachineIds(any(), captor.capture(), any());
        assertThat(captor.getValue().getOsTypes()).containsExactly(MAC_OS);
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: an explicit statuses filter reaches the repo — repo's default DELETED-guard opts out when caller constrains status")
    void findDeviceIdsForPlatforms_explicitStatuses_reachRepo() {
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.DELETED)).build();

        service().findDeviceIdsForPlatforms(List.of(MAC_OS), filter, null);

        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).findMachineIds(any(), captor.capture(), any());
        assertThat(captor.getValue().getStatuses()).containsExactly(DeviceStatus.DELETED.name());
    }

    @Test
    void queryAvailableDevicesForSchedule_restrictToMachineIds_pageAndCountNarrowedToThem() {
        // setup
        DeviceService s = service();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();

        // execution
        s.queryAvailableDevicesForSchedule(null, List.of("m1"), null, pagination, null, List.of("m1", "m2"));

        // verifications
        verify(machineRepository).findAvailableForScheduleWithCursor(eq(TENANT_ID), machineQueryFilterCaptor.capture(),
                isNull(), eq(List.of("m1")), eq(NO_POSITION), eq(false), eq(11));
        assertThat(machineQueryFilterCaptor.getValue().getRestrictToMachineIds()).containsExactly("m1", "m2");
        assertThat(capturedFilter().getRestrictToMachineIds()).containsExactly("m1", "m2");
    }

    @Test
    void queryAvailableDevicesForSchedule_noRestriction_everyDeviceOfThePicker() {
        // setup
        DeviceService s = service();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();

        // execution
        s.queryAvailableDevicesForSchedule(null, List.of("m1"), null, pagination, null);

        // verifications
        assertThat(capturedFilter().getRestrictToMachineIds()).isNull();
    }

    @Test
    void getAvailableDeviceFilters_restrictToMachineIds_facetsAndCountNarrowedToThem() {
        // setup
        DeviceService s = service();

        // execution
        s.getAvailableDeviceFilters(null, null, null, List.of("m1", "m2"));

        // verifications
        verify(machineRepository).facet(eq(TENANT_ID), machineQueryFilterCaptor.capture(), isNull(),
                eq(DeviceFacetDimension.OS_TYPE));
        assertThat(machineQueryFilterCaptor.getValue().getRestrictToMachineIds()).containsExactly("m1", "m2");
        assertThat(capturedFilter().getRestrictToMachineIds()).containsExactly("m1", "m2");
    }

    @Test
    void getAvailableDeviceFilters_noRestriction_everyDeviceOfThePicker() {
        // setup
        DeviceService s = service();

        // execution
        s.getAvailableDeviceFilters(null, null, null);

        // verifications
        assertThat(capturedFilter().getRestrictToMachineIds()).isNull();
    }

    @Test
    void findAllDeviceIds_restrictToMachineIds_onlyConnectedDevicesAmongThem() {
        // setup
        DeviceService s = service();
        when(machineRepository.findMachineIds(eq(TENANT_ID), machineQueryFilterCaptor.capture(), isNull()))
                .thenReturn(List.of("m1"));

        // execution
        List<String> result = s.findAllDeviceIds(null, null, List.of("m1", "m2"));

        // verifications
        assertThat(result).containsExactly("m1");
        assertThat(machineQueryFilterCaptor.getValue().getRestrictToMachineIds()).containsExactly("m1", "m2");
        assertThat(machineQueryFilterCaptor.getValue().getExcludeStatuses())
                .contains(DeviceStatus.DELETED.name(), DeviceStatus.ARCHIVED.name());
    }

    @Test
    void findAllDeviceIds_emptyRestriction_reachesTheQueryAsEmptyNotAsNoRestriction() {
        // setup
        DeviceService s = service();

        // execution
        s.findAllDeviceIds(null, null, List.of());

        // verifications
        verify(machineRepository).findMachineIds(eq(TENANT_ID), machineQueryFilterCaptor.capture(), isNull());
        assertThat(machineQueryFilterCaptor.getValue().getRestrictToMachineIds()).isEmpty();
    }

    @Test
    void findAllDeviceIds_noRestriction_everyDeviceOfThePicker() {
        // setup
        DeviceService s = service();

        // execution
        s.findAllDeviceIds(null, null);

        // verifications
        verify(machineRepository).findMachineIds(eq(TENANT_ID), machineQueryFilterCaptor.capture(), isNull());
        assertThat(machineQueryFilterCaptor.getValue().getRestrictToMachineIds()).isNull();
    }

    @Test
    @DisplayName("findAssignedDeviceIds: empty input → empty, no query issued")
    void findAssignedDeviceIds_empty() {
        assertThat(service().findAssignedDeviceIds(List.of(), null, null)).isEmpty();
        verify(machineRepository, never()).findMachineIds(any(), any(MachineQueryFilter.class), any());
    }

    @Test
    @DisplayName("findAssignedDeviceIds: no filter/search returns ALL assigned ids as-is (Remove All) without querying — so ids of deleted devices are still removable")
    void findAssignedDeviceIds_noFilter_returnsAllWithoutQuery() {
        DeviceService s = service();

        assertThat(s.findAssignedDeviceIds(List.of("m1", "m2-deleted"), null, null))
                .containsExactly("m1", "m2-deleted");
        // blank search is also treated as "no search"
        assertThat(s.findAssignedDeviceIds(List.of("m1"), null, "   ")).containsExactly("m1");

        verify(machineRepository, never()).findMachineIds(any(), any(MachineQueryFilter.class), any());
    }

    @Test
    @DisplayName("findAssignedDeviceIds: WITH a filter narrows the assigned ids via the Machine query — restrictToMachineIds carries the assigned set")
    void findAssignedDeviceIds_withFilter_queries() {
        DeviceService s = service();
        when(machineRepository.findMachineIds(any(), any(MachineQueryFilter.class), any()))
                .thenReturn(List.of("m1"));

        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.ONLINE)).build();

        assertThat(s.findAssignedDeviceIds(List.of("m1", "m2"), filter, null))
                .containsExactly("m1");
        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).findMachineIds(any(), captor.capture(), any());
        assertThat(captor.getValue().getRestrictToMachineIds()).containsExactlyInAnyOrder("m1", "m2");
        assertThat(captor.getValue().getStatuses()).containsExactly(DeviceStatus.ONLINE.name());
    }

    @Test
    @DisplayName("updateStatusByMachineId: deleting a device removes it from all schedule assignments")
    void deletingDevice_cleansUpScheduleAssignments() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(m));
        when(deletedMachineCleanup.markDeleted(m)).thenReturn(new LifecycleChange(m, List.of()));

        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        verify(deletedMachineCleanup).markDeleted(m);
    }

    @Test
    void updateStatusByMachineId_deletedDeviceWasOnSchedules_recordsItsRemovalFromThem() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(m));
        List<AuditEntry> removals = List.of(AuditEntry.builder()
                .action(AuditAction.SCRIPT_SCHEDULE_DEVICES_REMOVE)
                .targetId("schedule-1")
                .build());
        when(deletedMachineCleanup.markDeleted(m)).thenReturn(new LifecycleChange(m, removals));

        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        verify(auditRecorder).recordAll(removals);
    }

    @Test
    void deletingAlreadyDeletedDeviceRepeatsScheduleCleanupWithoutPublishingAgain() {
        // setup
        Machine machine = new Machine();
        machine.setTenantId("t-1");
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(machine));
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(new LifecycleChange(machine, List.of()));

        // execution
        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        // verifications
        verify(deletedMachineCleanup).markDeleted(machine);
        verifyNoInteractions(machineWriter, deviceStatusProcessor);
    }

    @Test
    @DisplayName("A failed deletion does not run the device status post-processor")
    void deletingDevice_failedDeletionDoesNotPostProcess() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(m));
        doThrow(new RuntimeException("mongo hiccup"))
                .when(deletedMachineCleanup).markDeleted(m);

        assertThatThrownBy(() -> service().updateStatusByMachineId("m-del", DeviceStatus.DELETED))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("mongo hiccup");

        verify(machineWriter, never()).update(any(), any(MachineUpdate.class));
        verify(machineRepository, never()).save(any());
        assertThat(m.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verifyNoInteractions(deviceStatusProcessor);
    }

    @Test
    @DisplayName("updateStatusByMachineId: archiving a MANAGED device does not touch schedule assignments")
    void archiving_noAssignmentCleanup() {
        Machine m = new Machine();
        m.setMachineId("m-arc");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.MANAGED);
        when(machineRepository.findOnPrimaryByMachineId("m-arc")).thenReturn(Optional.of(m));
        stubStatusWrite(m);

        service().updateStatusByMachineId("m-arc", DeviceStatus.ARCHIVED);

        verify(deletedMachineCleanup, never()).markDeleted(any());
    }

    @Test
    @DisplayName("updateStatusByMachineId: archiving leaves CONNECTED, so the device is re-filtered out of the counters")
    void archiving_syncsConnectivityOff() {
        Machine m = new Machine();
        m.setMachineId("m-arc");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.MANAGED);
        when(machineRepository.findOnPrimaryByMachineId("m-arc")).thenReturn(Optional.of(m));
        stubStatusWrite(m);

        service().updateStatusByMachineId("m-arc", DeviceStatus.ARCHIVED);

        verify(deviceSoftwareConnectivitySync).onConnectivityChanged("t-1", "m-arc", false);
        verify(machineWriter).update(eq("m-arc"), statusUpdateCaptor.capture());
        assertThat(statusUpdateCaptor.getValue().paths()).containsExactly("status");
        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateStatusByMachineId: a PENDING device counts in Software, so archiving it takes it out of the counters")
    void archivingPending_syncsConnectivityOff() {
        // setup
        Machine m = new Machine();
        m.setMachineId("m-pen");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.PENDING);
        when(machineRepository.findOnPrimaryByMachineId("m-pen")).thenReturn(Optional.of(m));
        stubStatusWrite(m);

        // execution
        service().updateStatusByMachineId("m-pen", DeviceStatus.ARCHIVED);

        // verifications
        verify(deviceSoftwareConnectivitySync).onConnectivityChanged("t-1", "m-pen", false);
    }

    @Test
    @DisplayName("updateStatusByMachineId: archiving a DELETED device has nothing left in Software to take out")
    void archivingDeleted_noConnectivitySync() {
        // setup
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(m));
        stubStatusWrite(m);

        // execution
        service().updateStatusByMachineId("m-del", DeviceStatus.ARCHIVED);

        // verifications
        verify(deviceSoftwareConnectivitySync, never()).onConnectivityChanged(any(), any(), anyBoolean());
        verify(machineWriter).update(eq("m-del"), any(MachineUpdate.class));
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"DELETED", "ARCHIVED"}, mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("updateStatusByMachineId: only DELETED and ARCHIVED can be set through the API")
    void updateStatus_outsideWhitelist_badRequestAndNothingRead(DeviceStatus status) {
        DeviceService s = service();

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> s.updateStatusByMachineId("m-1", status));

        assertThat(ex.getMessage()).contains("only be set to DELETED or ARCHIVED");
        verify(machineRepository, never()).findOnPrimaryByMachineId(any());
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(deletedMachineCleanup, deviceSoftwareConnectivitySync, deviceStatusProcessor);
    }

    @Test
    @DisplayName("updateStatusByMachineId: DELETED hard-removes rows and never goes through the connectivity sync")
    void deleting_usesCleanupNotConnectivitySync() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findOnPrimaryByMachineId("m-del")).thenReturn(Optional.of(m));
        when(deletedMachineCleanup.markDeleted(m)).thenReturn(new LifecycleChange(m, List.of()));

        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        verify(deviceSoftwareConnectivitySync, never()).onConnectivityChanged(any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("updateStatusByMachineId: writes only the status field and post-processes the stored result")
    void statusChange_fieldLevelWrite_postProcessesTheWrittenMachine() {
        Machine m = new Machine();
        m.setMachineId("m-arc");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.MANAGED);
        when(machineRepository.findOnPrimaryByMachineId("m-arc")).thenReturn(Optional.of(m));
        stubStatusWrite(m);

        service().updateStatusByMachineId("m-arc", DeviceStatus.ARCHIVED);

        verify(machineWriter).update(eq("m-arc"), statusUpdateCaptor.capture());
        assertThat(statusUpdateCaptor.getValue().paths()).containsExactly("status");
        ArgumentCaptor<Machine> processed = ArgumentCaptor.forClass(Machine.class);
        verify(deviceStatusProcessor).postProcessStatusUpdated(processed.capture());
        assertThat(processed.getValue().getStatus()).isEqualTo(DeviceStatus.ARCHIVED);
        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateStatusByMachineId: a device removed between the read and the write is not found")
    void statusChange_deviceGoneBeforeTheWrite_notFound() {
        Machine m = new Machine();
        m.setMachineId("m-arc");
        m.setStatus(DeviceStatus.MANAGED);
        when(machineRepository.findOnPrimaryByMachineId("m-arc")).thenReturn(Optional.of(m));
        when(machineWriter.update(eq("m-arc"), any(MachineUpdate.class))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().updateStatusByMachineId("m-arc", DeviceStatus.ARCHIVED))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(deviceStatusProcessor);
    }

    private void stubStatusWrite(Machine stored) {
        when(machineWriter.update(eq(stored.getMachineId()), any(MachineUpdate.class)))
                .thenAnswer(inv -> {
                    Machine after = new Machine();
                    after.setMachineId(stored.getMachineId());
                    after.setTenantId(stored.getTenantId());
                    after.setStatus(stored.getStatus());
                    inv.getArgument(1, MachineUpdate.class).applyTo(after);
                    return Optional.of(new MachineWriteResult(stored, after));
                });
    }


    private void stubAtomicNicknameUpdate(String machineId) {
        when(machineWriter.update(eq(machineId), any(MachineUpdate.class)))
                .thenAnswer(inv -> {
                    Machine before = new Machine();
                    before.setMachineId(inv.getArgument(0));
                    Machine after = new Machine();
                    after.setMachineId(inv.getArgument(0));
                    after.setUpdatedAt(Instant.now());
                    inv.getArgument(1, MachineUpdate.class).applyTo(after);
                    return Optional.of(new MachineWriteResult(before, after));
                });
    }

    private String capturedNickname() {
        ArgumentCaptor<MachineUpdate> captor = ArgumentCaptor.forClass(MachineUpdate.class);
        verify(machineWriter).update(any(), captor.capture());
        Machine probe = new Machine();
        captor.getValue().applyTo(probe);
        return probe.getNickname();
    }

    @Test
    @DisplayName("updateNickname: trims the value, bumps updatedAt, returns the updated device")
    void updateNickname_setsAndSaves() {
        DeviceService s = service();
        stubAtomicNicknameUpdate("m1");

        Machine result = s.updateNickname("m1", "  Reception iMac  ");

        assertThat(result.getNickname()).isEqualTo("Reception iMac");
        assertThat(result.getUpdatedAt()).isNotNull();
        assertThat(capturedNickname()).isEqualTo("Reception iMac");
    }

    @Test
    @DisplayName("updateNickname: updates atomically — never a read-modify-write via save()")
    void updateNickname_doesNotSaveWholeDocument() {
        DeviceService s = service();
        stubAtomicNicknameUpdate("m1");

        s.updateNickname("m1", "Reception iMac");

        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).findByMachineId(any());
        verify(machineWriter).update(eq("m1"), any(MachineUpdate.class));
    }

    @Test
    @DisplayName("updateNickname: publishes the invalidation event for the renamed machine once the write succeeded")
    void updateNickname_publishesInvalidationEventAfterWrite() {
        DeviceService s = service();
        stubAtomicNicknameUpdate("m1");

        s.updateNickname("m1", "Reception iMac");

        ArgumentCaptor<DeviceNicknameUpdatedEvent> captor = ArgumentCaptor.forClass(DeviceNicknameUpdatedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().getMachineId()).isEqualTo("m1");
    }

    @Test
    @DisplayName("updateNickname: an unknown device fails before anything is published — nothing to invalidate")
    void updateNickname_unknownDevice_doesNotPublish() {
        DeviceService s = service();
        when(machineWriter.update(eq("m1"), any(MachineUpdate.class))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> s.updateNickname("m1", "Reception iMac"))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("updateNickname: a blank value clears the nickname (stored as null)")
    void updateNickname_blankClears() {
        DeviceService s = service();
        stubAtomicNicknameUpdate("m1");

        assertThat(s.updateNickname("m1", "   ").getNickname()).isNull();
        assertThat(capturedNickname()).isNull();
    }

    @Test
    @DisplayName("updateNickname: a null value clears the nickname")
    void updateNickname_nullClears() {
        DeviceService s = service();
        stubAtomicNicknameUpdate("m1");

        assertThat(s.updateNickname("m1", null).getNickname()).isNull();
        assertThat(capturedNickname()).isNull();
    }

    @Test
    @DisplayName("updateNickname: unknown machine → DeviceNotFoundException, nothing saved")
    void updateNickname_notFound() {
        DeviceService s = service();
        when(machineWriter.update(eq("nope"), any(MachineUpdate.class))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> s.updateNickname("nope", "x"))
                .isInstanceOf(DeviceNotFoundException.class);
        verify(machineRepository, never()).save(any());
    }

    @ParameterizedTest
    @CsvSource({
            "3, 2, 2, true",
            "2, 2, 2, false",
            "1, 2, 1, false",
            "0, 2, 0, false"
    })
    void queryDevices_rowsReturnedAgainstLimit_pageTrimmedAndNextPageFlagged(
            int returned, int limit, int expectedItems, boolean expectedHasNextPage) {
        DeviceService s = service();
        stubIdCursors();
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(NO_POSITION), eq(false), eq(limit + 1), isNull(), eq("DESC"))).thenReturn(machinesWithIds(returned));

        CountedGenericQueryResult<Machine> result = s.queryDevices(null, page(limit, null), null, null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @Test
    void queryDevices_moreRowsThanLimit_endCursorIsLastShownRowNotProbeRow() {
        DeviceService s = service();
        stubIdCursors();
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(NO_POSITION), eq(false), eq(3), isNull(), eq("DESC"))).thenReturn(machinesWithIds(3));

        CountedGenericQueryResult<Machine> result = s.queryDevices(null, page(2, null), null, null);

        assertThat(result.getItems()).extracting(Machine::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo())
                .returns(idCursor("id-1").encode(), PageInfo::getStartCursor)
                .returns(idCursor("id-2").encode(), PageInfo::getEndCursor);
    }

    @Test
    void queryDevices_noRows_noCursorsAndNoNextPage() {
        DeviceService s = service();

        CountedGenericQueryResult<Machine> result = s.queryDevices(null, page(2, null), null, null);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void queryDevices_cursorGiven_hasPreviousPage() {
        DeviceService s = service();
        stubIdCursors();
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(new CursorPosition.RowId(ROW_1)), eq(false), eq(3), isNull(), eq("DESC"))).thenReturn(machinesWithIds(1));

        CountedGenericQueryResult<Machine> result = s.queryDevices(null, page(2, ROW_1), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void queryDevicesAmong_restrictedToTheMachines_hidingWhatTheDevicesListHides() {
        // setup
        DeviceService s = service();

        // execution
        s.queryDevicesAmong(List.of("m1", "m2"), null, page(10, null), null, null);

        // verifications
        MachineQueryFilter filter = capturedFilter();
        assertThat(filter.getRestrictToMachineIds()).containsExactly("m1", "m2");
        assertThat(filter.getStatuses()).isNull();
        assertThat(filter.getExcludeStatuses()).isNull();
    }

    @Test
    void queryDevicesAmong_customerAndStatusFilter_narrowTheQuery() {
        // setup
        DeviceService s = service();
        DeviceFilterCriteria criteria = DeviceFilterCriteria.builder()
                .organizationIds(List.of("org-a"))
                .statuses(List.of(DeviceStatus.MANAGED))
                .build();

        // execution
        s.queryDevicesAmong(List.of("m1"), criteria, page(10, null), "mac", null);

        // verifications
        verify(machineRepository).countMachines(eq(TENANT_ID), machineQueryFilterCaptor.capture(), eq("mac"));
        MachineQueryFilter filter = machineQueryFilterCaptor.getValue();
        assertThat(filter.getOrganizationIds()).containsExactly("org-a");
        assertThat(filter.getStatuses()).containsExactly(DeviceStatus.MANAGED.name());
        assertThat(filter.getRestrictToMachineIds()).containsExactly("m1");
    }

    @Test
    void queryDevicesAmong_sort_reachesThePageQuery() {
        // setup
        DeviceService s = service();
        when(machineRepository.isSortableField("hostname")).thenReturn(true);
        SortInput byHostname = SortInput.builder().field("hostname").direction(SortDirection.ASC).build();

        // execution
        s.queryDevicesAmong(List.of("m1"), null, page(10, null), null, byHostname);

        // verifications
        verify(machineRepository).findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(NO_POSITION), eq(false), eq(11), eq("hostname"), eq("ASC"));
    }

    @Test
    void queryDevicesAmong_noMachines_restrictedToNoDevice() {
        // setup
        DeviceService s = service();

        // execution
        s.queryDevicesAmong(null, null, page(10, null), null, null);

        // verifications
        assertThat(capturedFilter().getRestrictToMachineIds()).isEmpty();
    }

    @Test
    void getDeviceFiltersAmong_facetsAndCountRestrictedToTheMachines() {
        // setup
        DeviceService s = service();
        DeviceFilterCriteria criteria = DeviceFilterCriteria.builder().organizationIds(List.of("org-a")).build();

        // execution
        s.getDeviceFiltersAmong(List.of("m1", "m2"), criteria, "mac");

        // verifications
        verify(machineRepository).facet(eq(TENANT_ID), machineQueryFilterCaptor.capture(), eq("mac"),
                eq(DeviceFacetDimension.ORGANIZATION_ID));
        MachineQueryFilter facetFilter = machineQueryFilterCaptor.getValue();
        assertThat(facetFilter.getRestrictToMachineIds()).containsExactly("m1", "m2");
        assertThat(facetFilter.getOrganizationIds()).containsExactly("org-a");
        assertThat(facetFilter.getExcludeStatuses()).isNull();
        assertThat(capturedFilter().getRestrictToMachineIds()).containsExactly("m1", "m2");
    }

    @ParameterizedTest
    @MethodSource("deviceSorts")
    void queryDevices_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(String sortField, SortDirection direction) {
        // setup
        DeviceService s = service();
        SortInput sort = SortInput.builder().field(sortField).direction(direction).build();
        stubDevicePages(sortField, direction.name());

        // execution
        CountedGenericQueryResult<Machine> pageOne = s.queryDevices(null, forward(2, null), null, sort);
        CountedGenericQueryResult<Machine> pageTwo =
                s.queryDevices(null, forward(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<Machine> backToPageOne =
                s.queryDevices(null, backward(2, pageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(Machine::getId).containsExactly(ROW_1, ROW_2);
        assertThat(pageTwo.getItems()).extracting(Machine::getId).containsExactly(ROW_3, ROW_4);
        assertThat(backToPageOne.getItems()).extracting(Machine::getId).containsExactly(ROW_1, ROW_2);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryDevices_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        DeviceService s = service();
        SortInput sort = SortInput.builder().field(HOSTNAME).direction(SortDirection.ASC).build();
        stubDevicePages(HOSTNAME, ASC);
        String cursor = cursorOfRow(anchorRow, HOSTNAME, ASC);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<Machine> result = s.queryDevices(null, pagination, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(Machine::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryDevices_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        DeviceService s = service();
        SortInput sort = SortInput.builder().field(HOSTNAME).direction(SortDirection.ASC).build();
        stubDevicePages(HOSTNAME, ASC);

        // execution
        CountedGenericQueryResult<Machine> result = s.queryDevices(null, backward(2, null), null, sort);

        // verifications
        assertThat(result.getItems()).extracting(Machine::getId).containsExactly(ROW_4, ROW_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(machineRepository).findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(NO_POSITION), eq(true), eq(3), eq(HOSTNAME), eq(ASC));
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void queryDevices_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRows(
            String sortField, SortDirection direction, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        DeviceService s = service();
        SortInput sort = SortInput.builder().field(sortField).direction(direction).build();
        stubDevicePages(sortField, direction.name());

        // execution
        PageInfo pageInfo = s.queryDevices(null, forward(2, null), null, sort).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void queryDevices_decodedKeysetCursorBackward_repositoryGetsTheKeysetPositionAndTheDirection() {
        // setup
        DeviceService s = service();
        SortInput sort = SortInput.builder().field(HOSTNAME).direction(SortDirection.ASC).build();
        when(machineRepository.isSortableField(HOSTNAME)).thenReturn(true);
        KeysetCursor cursor = KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, "host-c", ROW_3);
        CursorPaginationCriteria pagination = backward(2, cursor.encode());

        // execution
        s.queryDevices(null, pagination, null, sort);

        // verifications
        verify(machineRepository).findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(cursor), eq(true), eq(3), eq(HOSTNAME), eq(ASC));
    }

    @Test
    void queryDevices_decodedRowIdCursor_repositoryGetsTheRowId() {
        // setup
        DeviceService s = service();

        // execution
        s.queryDevices(null, page(2, ROW_3), null, null);

        // verifications
        verify(machineRepository).findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(new CursorPosition.RowId(ROW_3)), eq(false), eq(3), isNull(), eq("DESC"));
    }

    @Test
    void queryDevices_cursorInAnotherFormat_leftToTheRepositoryToReject() {
        // setup
        DeviceService s = service();
        CursorPosition unrecognised = new CursorPosition.Unrecognised("not-a-device-cursor");
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(unrecognised), eq(false), eq(3), isNull(), eq("DESC"))).thenThrow(new InvalidCursorException());
        CursorPaginationCriteria pagination = page(2, "not-a-device-cursor");

        // execution
        Throwable thrown = catchThrowable(() -> s.queryDevices(null, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void queryDevices_malformedKeysetPayload_throwsInvalidCursorBeforeAnyPageIsRead() {
        // setup
        DeviceService s = service();
        CursorPaginationCriteria pagination = page(2, "k1|hostname|ASC");

        // execution
        Throwable thrown = catchThrowable(() -> s.queryDevices(null, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(machineRepository, never()).findMachinesWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(CursorPosition.class), anyBoolean(), anyInt(), any(), any());
    }

    @Test
    void queryAvailableDevicesForSchedule_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain() {
        // setup
        DeviceService s = service();
        stubAvailablePages();

        // execution
        CountedGenericQueryResult<Machine> pageOne =
                s.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, null, forward(2, null), null);
        CountedGenericQueryResult<Machine> pageTwo = s.queryAvailableDevicesForSchedule(
                null, ASSIGNED_MACHINE_IDS, null, forward(2, pageOne.getPageInfo().getEndCursor()), null);
        CountedGenericQueryResult<Machine> backToPageOne = s.queryAvailableDevicesForSchedule(
                null, ASSIGNED_MACHINE_IDS, null, backward(2, pageTwo.getPageInfo().getStartCursor()), null);

        // verifications
        assertThat(pageOne.getItems()).extracting(Machine::getId).containsExactly(ROW_1, ROW_2);
        assertThat(pageTwo.getItems()).extracting(Machine::getId).containsExactly(ROW_3, ROW_4);
        assertThat(backToPageOne.getItems()).extracting(Machine::getId).containsExactly(ROW_1, ROW_2);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor)
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
    }

    @Test
    void queryAvailableDevicesForSchedule_pageInfoCursors_bucketKeysetCursorsOfTheFirstAndLastShownRows() {
        // setup
        DeviceService s = service();
        stubAvailablePages();
        KeysetCursor assignedOnline = new KeysetCursor("bucket", Sort.Direction.ASC, "0", ROW_1);
        KeysetCursor unassignedOnline = new KeysetCursor("bucket", Sort.Direction.ASC, "2", ROW_3);

        // execution
        PageInfo pageInfo = s.queryAvailableDevicesForSchedule(
                null, ASSIGNED_MACHINE_IDS, null, forward(3, null), null).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(assignedOnline);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(unassignedOnline);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void queryAvailableDevicesForSchedule_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        DeviceService s = service();
        stubAvailablePages();

        // execution
        CountedGenericQueryResult<Machine> result =
                s.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, null, backward(2, null), null);

        // verifications
        assertThat(result.getItems()).extracting(Machine::getId).containsExactly(ROW_4, ROW_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(machineRepository).findAvailableForScheduleWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class),
                isNull(), eq(ASSIGNED_MACHINE_IDS), eq(NO_POSITION), eq(true), eq(3));
    }

    @Test
    void queryAvailableDevicesForSchedule_middlePageBackward_bothFlagsSet() {
        // setup
        DeviceService s = service();
        stubAvailablePages();
        String beforeRowFour = cursorIssuer.availableForScheduleKeysetCursor(devices().get(3), ASSIGNED_MACHINE_IDS).encode();

        // execution
        CountedGenericQueryResult<Machine> result = s.queryAvailableDevicesForSchedule(
                null, ASSIGNED_MACHINE_IDS, null, backward(2, beforeRowFour), null);

        // verifications
        assertThat(result.getItems()).extracting(Machine::getId).containsExactly(ROW_2, ROW_3);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
    }

    @Test
    void queryAvailableDevicesForSchedule_cursorInTheOlderBucketFormat_repositoryGetsItAsItIs() {
        // setup
        DeviceService s = service();
        String olderFormat = "1|" + ROW_2;

        // execution
        s.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, null, page(2, olderFormat), null);

        // verifications
        verify(machineRepository).findAvailableForScheduleWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class),
                isNull(), eq(ASSIGNED_MACHINE_IDS), eq(new CursorPosition.Unrecognised(olderFormat)), eq(false), eq(3));
    }

    @Test
    void queryAvailableDevicesForSchedule_malformedKeysetPayload_throwsInvalidCursorBeforeAnyPageIsRead() {
        // setup
        DeviceService s = service();
        CursorPaginationCriteria pagination = page(2, "k1|bucket|ASC");

        // execution
        Throwable thrown = catchThrowable(
                () -> s.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, null, pagination, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(machineRepository, never()).findAvailableForScheduleWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(), any(CursorPosition.class), anyBoolean(), anyInt());
    }

    private static Stream<Arguments> deviceSorts() {
        return Stream.of("_id", HOSTNAME, "displayName", "nickname", "lastSeen", "status", "connectivity", "clientOutdated")
                .flatMap(sortField -> Stream.of(
                        arguments(sortField, SortDirection.ASC),
                        arguments(sortField, SortDirection.DESC)));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(ROW_1, ROW_2), false, true),
                arguments(false, 2, List.of(ROW_3, ROW_4), true, true),
                arguments(false, 4, List.of(ROW_5), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(ROW_4, ROW_5), true, false),
                arguments(true, 4, List.of(ROW_2, ROW_3), true, true),
                arguments(true, 3, List.of(ROW_1, ROW_2), false, true),
                arguments(true, 2, List.of(ROW_1), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        return Stream.of(
                arguments("_id", SortDirection.DESC,
                        new KeysetCursor("_id", Sort.Direction.DESC, "", ROW_1),
                        new KeysetCursor("_id", Sort.Direction.DESC, "", ROW_2)),
                arguments(HOSTNAME, SortDirection.ASC,
                        KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, "host-1", ROW_1),
                        KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, "host-2", ROW_2)),
                arguments("nickname", SortDirection.ASC,
                        KeysetCursor.ofString("nickname", Sort.Direction.ASC, null, ROW_1),
                        KeysetCursor.ofString("nickname", Sort.Direction.ASC, "nick-2", ROW_2)),
                arguments("lastSeen", SortDirection.DESC,
                        KeysetCursor.ofInstant("lastSeen", Sort.Direction.DESC, LAST_SEEN.plusSeconds(1), ROW_1),
                        KeysetCursor.ofInstant("lastSeen", Sort.Direction.DESC, LAST_SEEN.plusSeconds(2), ROW_2)),
                arguments("status", SortDirection.DESC,
                        new KeysetCursor("status", Sort.Direction.DESC, "5", ROW_1),
                        new KeysetCursor("status", Sort.Direction.DESC, "2", ROW_2)),
                arguments("connectivity", SortDirection.DESC,
                        new KeysetCursor("connectivity", Sort.Direction.DESC, "1", ROW_1),
                        new KeysetCursor("connectivity", Sort.Direction.DESC, "0", ROW_2)),
                arguments("clientOutdated", SortDirection.DESC,
                        new KeysetCursor("clientOutdated", Sort.Direction.DESC, "1", ROW_1),
                        new KeysetCursor("clientOutdated", Sort.Direction.DESC, "0", ROW_2)));
    }

    private static CursorPaginationCriteria page(int limit, String cursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(cursor).build();
    }

    private static List<Machine> machinesWithIds(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> {
            Machine m = new Machine();
            m.setId("id-" + i);
            return m;
        }).toList();
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static List<Machine> devices() {
        return IntStream.rangeClosed(1, ROWS.size()).mapToObj(DeviceServiceTest::device).toList();
    }

    private static Machine device(int row) {
        boolean first = row == 1;
        Machine machine = new Machine();
        machine.setId(ROWS.get(row - 1));
        machine.setMachineId("m-" + row);
        machine.setHostname("host-" + row);
        machine.setDisplayName("Display " + row);
        machine.setNickname(first ? null : "nick-" + row);
        machine.setLastSeen(LAST_SEEN.plusSeconds(row));
        machine.setStatus(first ? DeviceStatus.MANAGED : DeviceStatus.PENDING);
        machine.setTelemetryStatus(row % 2 == 1 ? TelemetryStatus.ONLINE : TelemetryStatus.OFFLINE);
        machine.setAgentVersionKey(first ? OUTDATED_VERSION_KEY : null);
        return machine;
    }

    private static List<Machine> rowsPast(List<Machine> displayOrder, CursorPosition position, boolean backward, int limit) {
        List<Machine> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        List<String> ids = fetchOrder.stream().map(Machine::getId).toList();
        int anchor = ids.indexOf(anchorId(position));
        return fetchOrder.stream().skip(anchor + 1L).limit(limit).toList();
    }

    private static String anchorId(CursorPosition position) {
        return switch (position) {
            case KeysetCursor keyset -> keyset.id();
            case CursorPosition.RowId rowId -> rowId.id();
            case CursorPosition.Unrecognised unrecognised -> unrecognised.decoded();
            case CursorPosition.None none -> "";
        };
    }

    private static KeysetCursor idCursor(String id) {
        return new KeysetCursor("_id", Sort.Direction.DESC, "", id);
    }

    private String cursorOfRow(int row, String sortField, String direction) {
        return row == 0 ? null : cursorIssuer.keysetCursor(device(row), sortField, direction).encode();
    }

    private void stubIdCursors() {
        lenient().when(machineRepository.keysetCursor(any(Machine.class), isNull(), eq("DESC")))
                .thenAnswer(call -> idCursor(call.<Machine>getArgument(0).getId()));
    }

    private void stubDevicePages(String sortField, String direction) {
        List<Machine> displayOrder = devices();
        when(machineRepository.isSortableField(sortField)).thenReturn(true);
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                any(CursorPosition.class), anyBoolean(), anyInt(), eq(sortField), eq(direction)))
                .thenAnswer(call -> rowsPast(displayOrder, call.getArgument(3), call.getArgument(4), call.getArgument(5)));
        lenient().when(machineRepository.keysetCursor(any(Machine.class), eq(sortField), eq(direction)))
                .thenAnswer(call -> cursorIssuer.keysetCursor(call.getArgument(0), sortField, direction));
    }

    private void stubAvailablePages() {
        List<Machine> displayOrder = devices();
        when(machineRepository.findAvailableForScheduleWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                eq(ASSIGNED_MACHINE_IDS), any(CursorPosition.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(displayOrder, call.getArgument(4), call.getArgument(5), call.getArgument(6)));
        when(machineRepository.availableForScheduleKeysetCursor(any(Machine.class), eq(ASSIGNED_MACHINE_IDS)))
                .thenAnswer(call -> cursorIssuer.availableForScheduleKeysetCursor(call.getArgument(0), ASSIGNED_MACHINE_IDS));
    }

    @Test
    void verifyExists_knownDevice_passes() {
        // setup
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));

        // execution
        service().verifyExists("machine-1");

        // verifications
        verify(machineRepository).findByMachineId("machine-1");
    }

    @Test
    void verifyExists_unknownDevice_throwsDeviceNotFound() {
        // setup
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex =
                assertThrows(DeviceNotFoundException.class, () -> service().verifyExists("machine-1"));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: machine-1");
    }

    @Test
    void findDeviceIdsOfOrganizations_organizations_machineIdsOfTheTenantInThoseOrganizations() {
        // setup
        when(machineRepository.findMachineIdsByCriteria(eq(TENANT_ID),
                argThat(machineQueryFilter ->
                        List.of("org-1").equals(machineQueryFilter.getOrganizationIds())
                                && machineQueryFilter.getStatuses() == null
                                && machineQueryFilter.getExcludeStatuses() == null),
                isNull())).thenReturn(List.of("machine-1"));

        // execution
        List<String> machineIds = service().findDeviceIdsOfOrganizations(List.of("org-1"));

        // verifications
        assertThat(machineIds).containsExactly("machine-1");
    }
}
