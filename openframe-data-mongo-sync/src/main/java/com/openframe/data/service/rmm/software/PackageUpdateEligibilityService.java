package com.openframe.data.service.rmm.software;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.service.machine.AgentVersion.isAtLeast;
import static java.util.stream.Collectors.toSet;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateEligibilityService {

    static final String FLAG = "package-auto-update";

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final MachineRepository machineRepository;

    public Set<String> eligibleMachines(SoftwareAction action, Collection<String> machineIds) {
        ClientFeatureFlag flag = machineIds.isEmpty() ? null : enabledFlag(action);
        if (flag == null) {
            return Set.of();
        }
        return machineRepository.findByMachineIdIn(machineIds).stream()
                .filter(m -> isAtLeast(m.getAgentVersion(), flag.getMinVersion()))
                .map(Machine::getMachineId)
                .collect(toSet());
    }

    public boolean isEligible(SoftwareAction action, Machine machine) {
        ClientFeatureFlag flag = enabledFlag(action);
        return flag != null && isAtLeast(machine.getAgentVersion(), flag.getMinVersion());
    }

    private ClientFeatureFlag enabledFlag(SoftwareAction action) {
        if (action != SoftwareAction.UPDATE) {
            return null;
        }
        ClientFeatureFlag flag = flag();
        return flag != null && flag.isEnabled() ? flag : null;
    }

    private ClientFeatureFlag flag() {
        try {
            Map<String, ClientFeatureFlag> flags = clientConfigurationService.get().getFeatureFlags();
            return flags == null ? null : flags.get(FLAG);
        } catch (IllegalStateException noConfig) {
            // a tenant without a client configuration simply has no flag — stay on the script path
            return null;
        }
    }
}
