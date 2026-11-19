package com.openframe.client.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolOsSupport;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolOsSupportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class ToolOsSupportSweepService {

    private static final String BEFORE_FIRST_MACHINE = "000000000000000000000000";
    private static final int PAGE_SIZE = 500;
    private static final Set<DeviceStatus> SWEPT_STATUSES =
            EnumSet.of(DeviceStatus.MANAGED, DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);

    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolOsSupportService toolOsSupportService;
    private final ToolOsSupportReconciler toolOsSupportReconciler;
    private final MachineRepository machineRepository;

    public void sweep() {
        integratedToolAgentService.getAllEnabled().forEach(this::sweepIfMinimumChanged);
    }

    private void sweepIfMinimumChanged(IntegratedToolAgent agent) {
        Map<String, String> current = minOsVersions(agent);
        Map<String, String> applied = Optional.ofNullable(agent.getAppliedMinOsVersions()).orElse(Map.of());
        if (current.equals(applied)) {
            return;
        }
        Optional<ToolType> toolType = toolOsSupportService.toolTypeOf(agent);
        if (toolType.isEmpty()) {
            log.warn("Skipped the minimum OS version sweep of {}: its tool has no tool type", agent.getKey());
            return;
        }
        log.info("Minimum OS versions of {} changed from {} to {}, sweeping machines", agent.getKey(), applied, current);
        int machines = sweepMachines(agent, toolType.get(), applied);
        integratedToolAgentService.markMinOsVersionsApplied(agent.getId(), current);
        log.info("Minimum OS version sweep of {} checked {} machine(s)", agent.getKey(), machines);
    }

    private int sweepMachines(IntegratedToolAgent agent, ToolType toolType, Map<String, String> applied) {
        int checked = 0;
        String cursor = BEFORE_FIRST_MACHINE;
        List<Machine> page;
        do {
            page = machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT_STATUSES, cursor, Limit.of(PAGE_SIZE));
            for (Machine machine : page) {
                if (!isBlank(machine.getOsVersion())) {
                    reconcile(machine, agent, toolType, applied);
                    checked++;
                }
            }
            if (!page.isEmpty()) {
                cursor = page.getLast().getId();
            }
        } while (page.size() == PAGE_SIZE);
        return checked;
    }

    private void reconcile(Machine machine, IntegratedToolAgent agent, ToolType toolType, Map<String, String> applied) {
        boolean wasUnsupported = ToolOsSupport.downloadOs(machine.getOsType())
                .map(applied::get)
                .map(previous -> ToolOsSupport.isBelow(machine.getOsVersion(), previous))
                .orElse(false);
        try {
            toolOsSupportReconciler.reconcile(machine, agent, toolType, wasUnsupported);
        } catch (RuntimeException e) {
            log.error("Minimum OS version sweep of {} failed for machine {}", agent.getKey(), machine.getMachineId(), e);
        }
    }

    private static Map<String, String> minOsVersions(IntegratedToolAgent agent) {
        List<DownloadConfiguration> configurations = Optional.ofNullable(agent.getDownloadConfigurations()).orElse(List.of());
        return configurations.stream()
                .filter(configuration -> configuration.getOs() != null && configuration.getMinOsVersion() != null)
                .collect(Collectors.toMap(DownloadConfiguration::getOs, DownloadConfiguration::getMinOsVersion,
                        (first, second) -> first));
    }
}
