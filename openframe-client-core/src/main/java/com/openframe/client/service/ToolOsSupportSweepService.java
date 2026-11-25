package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ToolOsSupportSweepService {

    static final String BEFORE_FIRST_MACHINE = "000000000000000000000000";
    static final int PAGE_SIZE = 500;
    private static final Set<DeviceStatus> SWEPT_STATUSES =
            EnumSet.of(DeviceStatus.MANAGED, DeviceStatus.PENDING);

    private final ToolOsSupportService toolOsSupportService;
    private final ToolOsSupportReconciler toolOsSupportReconciler;
    private final MachineRepository machineRepository;

    public void sweep() {
        List<AgentWithToolType> agents = toolOsSupportService.agentsWithToolType();
        if (agents.isEmpty()) {
            return;
        }
        int reconciled = 0;
        String cursor = BEFORE_FIRST_MACHINE;
        List<Machine> page;
        do {
            page = machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(SWEPT_STATUSES, cursor, Limit.of(PAGE_SIZE));
            for (Machine machine : page) {
                if (ToolOsSupportReconciler.needsReconcile(machine, agents)) {
                    reconcile(machine.getMachineId(), agents);
                    reconciled++;
                }
            }
            if (!page.isEmpty()) {
                cursor = page.getLast().getId();
            }
        } while (page.size() == PAGE_SIZE);
        if (reconciled > 0) {
            log.info("Minimum OS version sweep reconciled {} machine(s)", reconciled);
        }
    }

    private void reconcile(String machineId, List<AgentWithToolType> agents) {
        try {
            toolOsSupportReconciler.reconcileCurrent(machineId, agents);
        } catch (RuntimeException e) {
            log.error("Minimum OS version sweep failed for machine {}", machineId, e);
        }
    }
}
