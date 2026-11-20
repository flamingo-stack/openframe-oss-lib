package com.openframe.client.service;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolOsSupport;
import com.openframe.data.nats.delivery.ToolUninstallDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolInstallationOutcome;
import com.openframe.data.service.ToolInstallationService;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import com.openframe.data.service.machine.WithheldToolAgents;
import com.openframe.delivery.track.DeliveryTracker;
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
    private final MachineRepository machineRepository;
    private final InstalledAgentRepository installedAgentRepository;
    private final ToolConnectionRepository toolConnectionRepository;
    private final WithheldToolAgents withheldToolAgents;
    private final DeviceLifecycleService deviceLifecycleService;
    private final DeliveryTracker deliveryTracker;
    private final IntegratedToolAgentService integratedToolAgentService;

    public void reconcile(Machine machine) {
        reconcile(machine, toolOsSupportService.agentsWithMinOsVersion());
    }

    public void reconcile(Machine machine, List<AgentWithToolType> agents) {
        for (AgentWithToolType entry : agents) {
            reconcile(machine, entry.getAgent(), entry.getToolType());
        }
    }

    public void reconcileCurrent(String machineId, List<AgentWithToolType> agents) {
        machineRepository.findByMachineId(machineId).ifPresent(machine -> reconcile(machine, agents));
    }

    public static boolean needsReconcile(Machine machine, List<AgentWithToolType> agents) {
        return agents.stream().anyMatch(entry -> ToolOsSupport.isUnsupported(machine, entry.getAgent())
                || WithheldToolAgents.isWithheld(machine, entry.getAgent().getKey()));
    }

    private void reconcile(Machine machine, IntegratedToolAgent agent, ToolType toolType) {
        if (ToolOsSupport.isUnsupported(machine, agent)) {
            withhold(machine, agent, toolType);
        } else if (WithheldToolAgents.isWithheld(machine, agent.getKey())) {
            reinstall(machine, agent);
        }
    }

    private void withhold(Machine machine, IntegratedToolAgent agent, ToolType toolType) {
        String machineId = machine.getMachineId();
        String agentKey = agent.getKey();
        if (isPresent(machineId, agentKey, toolType) && !isUninstallInFlight(machineId, agentKey)) {
            ToolUninstallDeliverySeed seed = new ToolUninstallDeliverySeed(machineId, agentKey, toolType.name());
            if (!deliveryRouter.dispatch(seed)) {
                log.debug("Kept {} on machine {} below its minimum OS version: no route carries the uninstall",
                        agentKey, machineId);
                return;
            }
            log.info("Uninstalling {} from machine {}: its OS version is below the agent's minimum", agentKey, machineId);
        }
        withheldToolAgents.withhold(machine, agentKey);
        deviceLifecycleService.promoteIfReady(machineId);
    }

    public void completeUninstall(String machineId, String toolAgentId) {
        Optional<IntegratedToolAgent> uninstalled = integratedToolAgentService.findByKey(toolAgentId);
        Optional<ToolType> toolType = uninstalled.flatMap(toolOsSupportService::findToolType);
        if (toolType.isEmpty()) {
            log.warn("Uninstall of {} confirmed by machine {}, but the agent or its tool type is unknown", toolAgentId, machineId);
            return;
        }
        IntegratedToolAgent agent = uninstalled.get();
        toolConnectionRepository.deleteByMachineIdAndToolType(machineId, toolType.get());
        installedAgentRepository.deleteByMachineIdAndAgentTypeIn(machineId, agentTypesOf(agent));
        log.info("Machine {} confirmed the uninstall of {}: its tool records are dropped", machineId, toolAgentId);
        machineRepository.findByMachineId(machineId).ifPresent(machine -> settleAfterUninstall(machine, agent));
    }

    private void settleAfterUninstall(Machine machine, IntegratedToolAgent agent) {
        withheldToolAgents.withhold(machine, agent.getKey());
        if (ToolOsSupport.isUnsupported(machine, agent)) {
            deviceLifecycleService.promoteIfReady(machine.getMachineId());
            return;
        }
        reinstall(machine, agent);
    }

    private void reinstall(Machine machine, IntegratedToolAgent agent) {
        String machineId = machine.getMachineId();
        String agentKey = agent.getKey();
        if (isUninstallInFlight(machineId, agentKey)) {
            return;
        }
        if (installedAgentRepository.existsByMachineIdAndAgentType(machineId, agentKey)) {
            withheldToolAgents.release(machine, agentKey);
            return;
        }
        ToolInstallationOutcome outcome = toolInstallationService.process(machineId, agent);
        if (outcome == ToolInstallationOutcome.DISPATCHED) {
            withheldToolAgents.release(machine, agentKey);
            log.info("Installing {} on machine {}: its OS version now meets the agent's minimum", agentKey, machineId);
        }
    }

    private boolean isUninstallInFlight(String machineId, String agentKey) {
        return deliveryTracker.find(DeliveryType.TOOL_UNINSTALL, agentKey, machineId)
                .map(MachineDelivery::getStatus)
                .filter(DeliveryStatus.OPEN::contains)
                .isPresent();
    }

    private boolean isPresent(String machineId, String agentKey, ToolType toolType) {
        return installedAgentRepository.existsByMachineIdAndAgentType(machineId, agentKey)
                || toolConnectionRepository.findByMachineIdAndToolType(machineId, toolType).isPresent();
    }

    private static List<String> agentTypesOf(IntegratedToolAgent agent) {
        List<ToolAgentAsset> assets = Optional.ofNullable(agent.getAssets()).orElse(List.of());
        return Stream.concat(Stream.of(agent.getKey()), assets.stream().map(ToolAgentAsset::getId)).toList();
    }
}
