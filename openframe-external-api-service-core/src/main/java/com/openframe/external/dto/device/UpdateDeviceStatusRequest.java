package com.openframe.external.dto.device;

import com.openframe.data.document.device.DeviceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UpdateDeviceStatusRequest {
    @NotNull
    @Schema(description = "New device status.", example = "DELETED")
    private final DeviceStatus status;
}
