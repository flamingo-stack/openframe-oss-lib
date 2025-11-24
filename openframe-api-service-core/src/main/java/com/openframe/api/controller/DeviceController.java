package com.openframe.api.controller;

import com.openframe.api.service.DeviceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/devices")
@RequiredArgsConstructor
@Slf4j
public class DeviceController {

    private final DeviceService deviceService;

    @DeleteMapping("/{machineId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDevice(@PathVariable String machineId) {
        log.info("Internal API: Delete device {}", machineId);
        deviceService.softDeleteByMachineId(machineId);
    }
}
