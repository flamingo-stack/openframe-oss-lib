package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Focused on {@code queryAssignedDevices} — the schedule-scoped device query added for the
 * {@code ScriptSchedule.assignedDevices} Relay connection. Asserts the machineId restriction
 * lands on the Mongo query.
 */
@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    @Mock private MachineRepository machineRepository;
    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private DeviceStatusProcessor deviceStatusProcessor;
    @Mock private ScriptScheduleDeviceService scriptScheduleDeviceService;

    private DeviceService service() {
        DeviceService s = new DeviceService(machineRepository, tagRepository, tagAssignmentRepository,
                deviceStatusProcessor, scriptScheduleDeviceService);
        lenient().when(machineRepository.buildDeviceQuery(any(), any())).thenAnswer(inv -> new Query());
        lenient().when(machineRepository.countMachines(any())).thenReturn(0L);
        lenient().when(machineRepository.findMachinesWithCursor(any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());
        lenient().when(machineRepository.findAvailableForScheduleWithCursor(any(), any(), any(), anyInt()))
                .thenReturn(List.of());
        return s;
    }

    private Document capturedQueryObject() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(machineRepository).countMachines(captor.capture());
        return captor.getValue().getQueryObject();
    }

    @Test
    @DisplayName("queryAssignedDevices: restricts the query to the given machineIds (machineId $in [...])")
    void scopesToMachineIds() {
        service().queryAssignedDevices(List.of("m1", "m2"), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(q.get("machineId")).isInstanceOf(Document.class);
        @SuppressWarnings("unchecked")
        List<String> in = (List<String>) ((Document) q.get("machineId")).get("$in");
        assertThat(in).containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("queryAssignedDevices: an empty machineId set yields a no-match query (machineId $exists false)")
    void emptySetYieldsNoResults() {
        service().queryAssignedDevices(List.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(q.get("machineId")).isInstanceOf(Document.class);
        assertThat(((Document) q.get("machineId")).get("$exists")).isEqualTo(false);
    }

    @Test
    @DisplayName("queryAssignedDevices: a null machineId set is treated as empty (no results)")
    void nullSetTreatedAsEmpty() {
        service().queryAssignedDevices(null, null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(((Document) q.get("machineId")).get("$exists")).isEqualTo(false);
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: adds a case-insensitive osType constraint ($or of per-platform regexes)")
    void scopesToPlatforms() {
        service().queryDevicesForPlatforms(List.of("MACOS"), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(q.get("$or")).isInstanceOf(List.class);
        List<?> or = (List<?>) q.get("$or");
        assertThat(or).hasSize(1);
        assertThat((Document) or.get(0)).containsKey("osType");   // per-platform regex on osType
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: no platforms → no osType/platform constraint")
    void noPlatforms_noConstraint() {
        service().queryDevicesForPlatforms(List.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(q).doesNotContainKey("$or");
        assertThat(q).doesNotContainKey("osType");
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: returns all matching ids via a platform-scoped query")
    void findDeviceIdsForPlatforms_returnsIds() {
        DeviceService s = service();
        when(machineRepository.findMachineIds(any())).thenReturn(List.of("m1", "m2"));

        List<String> ids = s.findDeviceIdsForPlatforms(List.of("MACOS"), null, null);

        assertThat(ids).containsExactly("m1", "m2");
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(machineRepository).findMachineIds(captor.capture());
        assertThat(captor.getValue().getQueryObject()).containsKey("$or");   // platform scope applied
    }

    @Test
    @DisplayName("findAssignedDeviceIds: empty input → empty, no query issued")
    void findAssignedDeviceIds_empty() {
        DeviceService s = service();
        assertThat(s.findAssignedDeviceIds(List.of(), null, null)).isEmpty();
        verify(machineRepository, never()).findMachineIds(any());
    }

    @Test
    @DisplayName("findAssignedDeviceIds: no filter/search returns ALL assigned ids as-is (Remove All), without querying the Machine collection — so ids of deleted devices are still removable")
    void findAssignedDeviceIds_noFilter_returnsAllWithoutQuery() {
        DeviceService s = service();

        assertThat(s.findAssignedDeviceIds(List.of("m1", "m2-deleted"), null, null))
                .containsExactly("m1", "m2-deleted");
        // blank search is also treated as "no search"
        assertThat(s.findAssignedDeviceIds(List.of("m1"), null, "   ")).containsExactly("m1");

        verify(machineRepository, never()).findMachineIds(any());
    }

    @Test
    @DisplayName("findAssignedDeviceIds: WITH a filter narrows the assigned ids via the Machine query")
    void findAssignedDeviceIds_withFilter_queries() {
        DeviceService s = service();
        when(machineRepository.findMachineIds(any())).thenReturn(List.of("m1"));

        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.ONLINE)).build();

        assertThat(s.findAssignedDeviceIds(List.of("m1", "m2"), filter, null)).containsExactly("m1");
        verify(machineRepository).findMachineIds(any());
    }

    @Test
    @DisplayName("updateStatusByMachineId: deleting a device removes it from all schedule assignments")
    void deletingDevice_cleansUpScheduleAssignments() {
        Machine m = new Machine();
        m.setMachineId("m-del");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);   // current != DELETED so the status actually changes
        when(machineRepository.findByMachineId("m-del")).thenReturn(java.util.Optional.of(m));

        service().updateStatusByMachineId("m-del", DeviceStatus.DELETED);

        verify(scriptScheduleDeviceService).removeDeviceFromAllSchedules("t-1", "m-del");
    }

    @Test
    @DisplayName("updateStatusByMachineId: a non-DELETE status change does NOT touch schedule assignments")
    void nonDeleteStatus_noAssignmentCleanup() {
        Machine m = new Machine();
        m.setMachineId("m-off");
        m.setTenantId("t-1");
        m.setStatus(DeviceStatus.ONLINE);
        when(machineRepository.findByMachineId("m-off")).thenReturn(java.util.Optional.of(m));

        service().updateStatusByMachineId("m-off", DeviceStatus.OFFLINE);

        verify(scriptScheduleDeviceService, never()).removeDeviceFromAllSchedules(any(), any());
    }

    @Test
    @DisplayName("queryAssignedDevices: excludes DELETED devices by default (status $ne DELETED) when no status filter")
    void queryAssignedDevices_excludesDeleted() {
        service().queryAssignedDevices(List.of("m1"), null,
                CursorPaginationCriteria.builder().limit(10).build(), null, null);

        Document q = capturedQueryObject();
        assertThat(q.get("status")).isInstanceOf(Document.class);
        assertThat(((Document) q.get("status")).get("$ne")).isEqualTo(DeviceStatus.DELETED);
    }

    @Test
    @DisplayName("queryAvailableDevicesForSchedule: excludes DELETED devices by default (status $ne DELETED)")
    void queryAvailableDevicesForSchedule_excludesDeleted() {
        service().queryAvailableDevicesForSchedule(List.of(), java.util.Set.of(), null,
                CursorPaginationCriteria.builder().limit(10).build(), null);

        Document q = capturedQueryObject();
        assertThat(q.get("status")).isInstanceOf(Document.class);
        assertThat(((Document) q.get("status")).get("$ne")).isEqualTo(DeviceStatus.DELETED);
    }
}
