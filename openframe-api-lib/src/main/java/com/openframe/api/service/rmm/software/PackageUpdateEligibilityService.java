package com.openframe.api.service.rmm.software;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateEligibilityService {

    static final String FLAG = "package-auto-update";

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final MachineRepository machineRepository;

    public Set<String> eligibleMachines(Collection<String> machineIds) {
        if (machineIds.isEmpty()) {
            return Set.of();
        }
        ClientFeatureFlag flag = flag();
        if (flag == null || !flag.isEnabled()) {
            return Set.of();
        }
        String minVersion = flag.getMinVersion();
        return machineRepository.findByMachineIdIn(machineIds).stream()
                .filter(m -> versionAtLeast(m.getAgentVersion(), minVersion))
                .map(Machine::getMachineId)
                .collect(toSet());
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

    static boolean versionAtLeast(String actual, String min) {
        if (!hasText(actual)) {
            return false;
        }
        if (!hasText(min)) {
            return true;
        }
        return compare(actual, min) >= 0;
    }

    private static int compare(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        int n = Math.max(pa.length, pb.length);
        for (int i = 0; i < n; i++) {
            int va = part(pa, i);
            int vb = part(pb, i);
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return 0;
    }

    private static int part(String[] parts, int i) {
        if (i >= parts.length) {
            return 0;
        }
        try {
            return Integer.parseInt(parts[i].replaceAll("\\D.*$", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
