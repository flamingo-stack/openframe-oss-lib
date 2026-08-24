package com.openframe.api.dto.device;

import com.openframe.data.document.device.DeviceStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class UpdateDeviceStatusRequest {
    @NotNull
    private DeviceStatus status;
}
