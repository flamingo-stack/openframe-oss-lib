package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import static com.openframe.data.service.machine.MachineFields.WITHHELD_TOOL_AGENTS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Slf4j
@Service
@RequiredArgsConstructor
public class WithheldToolAgents {

    private final MachineWriter machineWriter;

    public static boolean isWithheld(Machine machine, String toolAgentId) {
        Set<String> withheld = machine.getWithheldToolAgents();
        return withheld != null && withheld.contains(toolAgentId);
    }

    public void withhold(Machine machine, String toolAgentId) {
        if (isWithheld(machine, toolAgentId)) {
            return;
        }
        Set<String> withheld = current(machine);
        withheld.add(toolAgentId);
        write(machine, withheld);
        log.info("Withheld {} from machine {}: its OS version is below the agent's minimum", toolAgentId, machine.getMachineId());
    }

    public void release(Machine machine, String toolAgentId) {
        if (!isWithheld(machine, toolAgentId)) {
            return;
        }
        Set<String> withheld = current(machine);
        withheld.remove(toolAgentId);
        write(machine, withheld);
        log.info("Released {} on machine {}", toolAgentId, machine.getMachineId());
    }

    private static Set<String> current(Machine machine) {
        return new TreeSet<>(Optional.ofNullable(machine.getWithheldToolAgents()).orElse(Set.of()));
    }

    private void write(Machine machine, Set<String> withheld) {
        machine.setWithheldToolAgents(withheld);
        machineWriter.update(machine.getMachineId(), machineUpdate().set(WITHHELD_TOOL_AGENTS, withheld));
    }
}
