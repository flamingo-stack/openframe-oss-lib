package com.openframe.api.controller;

import com.openframe.api.service.DeviceService;
import com.openframe.api.dto.device.UpdateDeviceStatusRequest;
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

	@PatchMapping("/{machineId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void updateDeviceStatus(@PathVariable String machineId,
	                               @RequestBody UpdateDeviceStatusRequest request) {
		log.info("Internal API: Update device status {} -> {}", machineId, request.status());
		deviceService.updateStatusByMachineId(machineId, request.status());
	}
}
