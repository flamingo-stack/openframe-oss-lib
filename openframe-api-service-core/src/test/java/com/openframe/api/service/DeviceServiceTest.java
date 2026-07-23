package com.openframe.api.service;

import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.processor.DeviceStatusProcessor;
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

    private DeviceService service() {
        DeviceService s = new DeviceService(machineRepository, tagRepository, tagAssignmentRepository, deviceStatusProcessor);
        lenient().when(machineRepository.buildDeviceQuery(any(), any())).thenAnswer(inv -> new Query());
        lenient().when(machineRepository.countMachines(any())).thenReturn(0L);
        lenient().when(machineRepository.findMachinesWithCursor(any(), any(), anyInt(), any(), any()))
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
}
