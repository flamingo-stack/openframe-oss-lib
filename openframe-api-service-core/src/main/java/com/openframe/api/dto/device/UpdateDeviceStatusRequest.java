package com.openframe.api.dto.device;

import com.openframe.data.document.device.DeviceStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateDeviceStatusRequest(@NotNull DeviceStatus status) {}
