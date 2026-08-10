package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.repository.device.MachineFirstOnlineDispatchRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.rmm.OsType.MAC_OS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MachineRepository machineRepository;
    @Mock private MachineFirstOnlineDispatchRepository machineFirstOnlineDispatchRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private DeviceStatusProcessor deviceStatusProcessor;
    @Mock private ScriptScheduleDeviceService scriptScheduleDeviceService;
    @Mock private DeviceFilterOptionMapper deviceFilterOptionMapper;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private DeviceService service() {
        DeviceService s = new DeviceService(machineRepository, machineFirstOnlineDispatchRepository, machineWriter,
                tagRepository, tagAssignmentRepository,
                deviceStatusProcessor, scriptScheduleDeviceService, deviceFilterOptionMapper, tenantIdProvider);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        lenient().when(machineRepository.countMachines(any(), any(MachineQueryFilter.class), any())).thenReturn(0L);
        lenient().when(machineRepository.findMachinesWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(), anyInt(), any(), any())).thenReturn(List.of());
        lenient().when(machineRepository.findAvailableForScheduleWithCursor(any(), any(MachineQueryFilter.class), any(),
                any(), any(), anyInt())).thenReturn(List.of());
        lenient().when(machineRepository.findMachineIds(any(), any(MachineQueryFilter.class), any())).thenReturn(List.of());
        return s;
    }

    private MachineQueryFilter capturedFilter() {
        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).countMachines(any(), captor.capture(), any());
        return captor.getValue();
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
    @DisplayName("queryDevicesForPlatforms: passes platform names on the filter — repo expands to osType $in")
    void scopesToPlatforms() {
        service().queryDevicesForPlatforms(List.of(MAC_OS), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getPlatformNames()).containsExactly("MAC_OS");
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: empty platform list → no platformNames on the filter")
    void noPlatforms_noConstraint() {
        service().queryDevicesForPlatforms(List.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(capturedFilter().getPlatformNames()).isNullOrEmpty();
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: delegates to repo.findMachineIds with a filter carrying platformNames")
    void findDeviceIdsForPlatforms_returnsIds() {
        DeviceService s = service();
        when(machineRepository.findMachineIds(any(), any(MachineQueryFilter.class), any()))
                .thenReturn(List.of("m1", "m2"));

        List<String> ids = s.findDeviceIdsForPlatforms(List.of(MAC_OS), null, null);

        assertThat(ids).containsExactly("m1", "m2");
        ArgumentCaptor<MachineQueryFilter> captor = ArgumentCaptor.forClass(MachineQueryFilter.class);
        verify(machineRepository).findMachineIds(any(), captor.capture(), any());
        assertThat(captor.getValue().getPlatformNames()).containsExactly("MAC_OS");
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
        when(machineRepository.findByMachineId("m-del")).thenReturn(Optional.of(m));

        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        verify(scriptScheduleDeviceService).removeDeviceFromAllSchedules("t-1", "m-del");
        verify(machineFirstOnlineDispatchRepository).deleteByTenantIdAndMachineId("t-1", "m-del");
    }

    @Test
    @DisplayName("updateStatusByMachineId: cleanup runs BEFORE the DELETED save — if cleanup throws, status stays put so the next attempt can retry")
    void deletingDevice_cleanupFailsBeforeSave_statusStaysUnchanged() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findByMachineId("m-del")).thenReturn(Optional.of(m));
        doThrow(new RuntimeException("mongo hiccup"))
                .when(scriptScheduleDeviceService).removeDeviceFromAllSchedules("t-1", "m-del");

        assertThatThrownBy(() -> service().updateStatusByMachineId("m-del", DeviceStatus.DELETED))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("mongo hiccup");

        verify(scriptScheduleDeviceService).removeDeviceFromAllSchedules("t-1", "m-del");
        verify(machineRepository, never()).save(any());
        assertThat(m.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verifyNoInteractions(deviceStatusProcessor);
    }

    @Test
    @DisplayName("updateStatusByMachineId: a non-DELETE status change does NOT touch schedule assignments")
    void nonDeleteStatus_noAssignmentCleanup() {
        Machine m = new Machine();
        m.setMachineId("m-off");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findByMachineId("m-off")).thenReturn(Optional.of(m));

        service().updateStatusByMachineId("m-off", DeviceStatus.OFFLINE);

        verify(scriptScheduleDeviceService, never()).removeDeviceFromAllSchedules(any(), any());
        verify(machineFirstOnlineDispatchRepository, never()).deleteByTenantIdAndMachineId(any(), any());
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
}
