package com.openframe.management.controller;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditCapture;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.MachineTagEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.PLATFORM_DEVICE_INDEX_SYNC;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

@Slf4j
@RestController
@RequestMapping("/v1/devices")
@RequiredArgsConstructor
public class DevicePinotResyncController {

    private final MachineRepository machineRepository;
    private final AuditCapture auditCapture;
    private final MachineTagEventService machineTagEventService;

    @PostMapping("/pinot-resync")
    public ResponseEntity<Map<String, Object>> resyncAllDevicesToPinot() {
        AuditCall call = AuditCall.of(PLATFORM_DEVICE_INDEX_SYNC, DEVICE, null, Map.of())
                .withCompare(false)
                .withDetailsFromResult(count -> Map.of("count", count));
        int count = auditCapture.capture(call, this::resync);
        return ResponseEntity.ok(Map.of("status", "completed", "count", count));
    }

    private int resync() {
        log.info("Starting Pinot device resync for all machines");
        List<Machine> machines = machineRepository.findAll();
        log.info("Found {} machines to resync", machines.size());
        machineTagEventService.processMachineSaveAll(machines);
        log.info("Pinot device resync completed for {} machines", machines.size());
        return machines.size();
    }
}
