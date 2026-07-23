package com.openframe.api.dataloader;

import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptScheduleDeviceMachinesDataLoaderTest {

    @Mock private ScriptScheduleDeviceService deviceService;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private ScriptScheduleDeviceMachinesDataLoader loader;

    private static Machine machine(String id) {
        Machine m = new Machine();
        m.setMachineId(id);
        return m;
    }

    @Test
    @DisplayName("both lookups happen in ONE batch, results are per-schedule and in input order, missing machines dropped")
    void batchesBothLookups() {
        when(deviceService.getMachineIdsByScheduleIds(List.of("s1", "s2")))
                .thenReturn(Map.of("s1", List.of("m1", "m2"), "s2", List.of("m2", "m3")));
        // one machine lookup over the union; m3 no longer resolves
        when(machineRepository.findByMachineIdIn(any()))
                .thenReturn(List.of(machine("m1"), machine("m2")));

        List<List<Machine>> result = loader.load(List.of("s1", "s2")).toCompletableFuture().join();

        assertThat(result).hasSize(2);
        assertThat(result.get(0)).extracting(Machine::getMachineId).containsExactly("m1", "m2");
        assertThat(result.get(1)).extracting(Machine::getMachineId).containsExactly("m2");   // m3 dropped
        verify(machineRepository).findByMachineIdIn(any());   // exactly one machine query
    }

    @Test
    @DisplayName("a schedule with no assigned machines yields an empty list and triggers no machine query")
    void noMachines_noMachineQuery() {
        when(deviceService.getMachineIdsByScheduleIds(List.of("s1")))
                .thenReturn(Map.of("s1", List.of()));

        List<List<Machine>> result = loader.load(List.of("s1")).toCompletableFuture().join();

        assertThat(result).containsExactly(List.of());
        verify(machineRepository, never()).findByMachineIdIn(any());
    }

    @Test
    @DisplayName("a schedule absent from the map resolves to an empty list, preserving positional order")
    void scheduleAbsentFromMap_emptyList() {
        when(deviceService.getMachineIdsByScheduleIds(List.of("s1", "s2")))
                .thenReturn(Map.of("s1", List.of("m1")));   // s2 has no entry
        when(machineRepository.findByMachineIdIn(any())).thenReturn(List.of(machine("m1")));

        List<List<Machine>> result = loader.load(List.of("s1", "s2")).toCompletableFuture().join();

        assertThat(result.get(0)).extracting(Machine::getMachineId).containsExactly("m1");
        assertThat(result.get(1)).isEmpty();
    }
}
