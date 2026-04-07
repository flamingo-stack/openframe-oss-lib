package com.openframe.management.controller;

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

@Slf4j
@RestController
@RequestMapping("/v1/devices")
@RequiredArgsConstructor
public class DevicePinotResyncController {

    private final MachineRepository machineRepository;
    private final MachineTagEventService machineTagEventService;

    @PostMapping("/pinot-resync")
    public ResponseEntity<Map<String, Object>> resyncAllDevicesToPinot() {
        log.info("Starting Pinot device resync for all machines");
        List<Machine> machines = machineRepository.findAll();
        log.info("Found {} machines to resync", machines.size());
        machineTagEventService.processMachineSaveAll(machines);
        log.info("Pinot device resync completed for {} machines", machines.size());
        return ResponseEntity.ok(Map.of("status", "completed", "count", machines.size()));
    }
}
