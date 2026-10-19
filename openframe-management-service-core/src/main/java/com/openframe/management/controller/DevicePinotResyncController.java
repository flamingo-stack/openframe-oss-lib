package com.openframe.management.controller;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.MachineTagEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
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

    private static final int PAGE_SIZE = 500;

    private final MachineRepository machineRepository;
    private final MachineTagEventService machineTagEventService;

    @PostMapping("/pinot-resync")
    public ResponseEntity<Map<String, Object>> resyncAllDevicesToPinot() {
        log.info("Accepted request to start Pinot device resync for all machines");
        resyncAllDevicesToPinotAsync();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "accepted"));
    }

    @Async
    protected void resyncAllDevicesToPinotAsync() {
        log.info("Starting Pinot device resync for all machines");
        int pageNumber = 0;
        long totalCount = 0;
        Page<Machine> page;
        do {
            page = machineRepository.findAll(PageRequest.of(pageNumber, PAGE_SIZE));
            List<Machine> machines = page.getContent();
            if (!machines.isEmpty()) {
                machineTagEventService.processMachineSaveAll(machines);
                totalCount += machines.size();
                log.info("Resynced batch {} with {} machines ({} total so far)", pageNumber, machines.size(), totalCount);
            }
            pageNumber++;
        } while (page.hasNext());
        log.info("Pinot device resync completed for {} machines", totalCount);
    }
}

