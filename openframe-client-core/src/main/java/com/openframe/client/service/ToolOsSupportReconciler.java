package com.openframe.client.service;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolOsSupport;
import com.openframe.data.nats.delivery.ToolUninstallDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.ToolInstallationService;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class ToolOsSupportReconciler {

    private final ToolOsSupportService toolOsSupportService;
    private final ToolInstallationService toolInstallationService;
    private final DeliveryRouter deliveryRouter;
    private final InstalledAgentRepository installedAgentRepository;
    private final ToolConnectionRepository toolConnectionRepository;
    private final DeviceLifecycleService deviceLifecycleService;

    public void reconcile(Machine machine, String previousOsVersion) {
        for (AgentWithToolType entry : toolOsSupportService.agentsWithMinOsVersion()) {
            IntegratedToolAgent agent = entry.agent();
            boolean wasUnsupported = ToolOsSupport.minOsVersion(agent, machine.getOsType())
                    .map(minimum -> ToolOsSupport.isBelow(previousOsVersion, minimum))
                    .orElse(false);
            reconcile(machine, agent, entry.toolType(), wasUnsupported);
        }
    }

    public void reconcile(Machine machine, IntegratedToolAgent agent, ToolType toolType, boolean wasUnsupported) {
        if (ToolOsSupport.isUnsupported(machine, agent)) {
            uninstallIfPresent(machine.getMachineId(), agent, toolType);
        } else if (wasUnsupported) {
            installIfMissing(machine.getMachineId(), agent);
        }
    }

    private void uninstallIfPresent(String machineId, IntegratedToolAgent agent, ToolType toolType) {
        String agentKey = agent.getKey();
        boolean present = installedAgentRepository.existsByMachineIdAndAgentType(machineId, agentKey)
                || toolConnectionRepository.findByMachineIdAndToolType(machineId, toolType).isPresent();
        if (!present) {
            return;
        }
        ToolUninstallDeliverySeed seed = new ToolUninstallDeliverySeed(machineId, agentKey, toolType.name());
        if (!deliveryRouter.dispatch(seed)) {
            log.info("Kept {} on machine {} below its minimum OS version: no route carries the uninstall", agentKey, machineId);
            return;
        }
        toolConnectionRepository.deleteByMachineIdAndToolType(machineId, toolType);
        installedAgentRepository.deleteByMachineIdAndAgentTypeIn(machineId, agentTypesOf(agent));
        log.info("Uninstalling {} from machine {}: its OS version is below the agent's minimum", agentKey, machineId);
        deviceLifecycleService.promoteIfReady(machineId);
    }

    private void installIfMissing(String machineId, IntegratedToolAgent agent) {
        String agentKey = agent.getKey();
        if (installedAgentRepository.existsByMachineIdAndAgentType(machineId, agentKey)) {
            return;
        }
        log.info("Installing {} on machine {}: its OS version now meets the agent's minimum", agentKey, machineId);
        toolInstallationService.process(machineId, agent);
    }

    private static List<String> agentTypesOf(IntegratedToolAgent agent) {
        List<ToolAgentAsset> assets = Optional.ofNullable(agent.getAssets()).orElse(List.of());
        return Stream.concat(Stream.of(agent.getKey()), assets.stream().map(ToolAgentAsset::getId)).toList();
    }
}
