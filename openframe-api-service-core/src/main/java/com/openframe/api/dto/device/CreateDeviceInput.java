package com.openframe.api.dto.device;

import com.openframe.data.document.device.DeviceType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeviceInput {

    @NotBlank(message = "Organization ID is required")
    private String organizationId;

    private String displayName;

    private String hostname;

    private DeviceType type;

    @NotBlank(message = "OS type is required")
    private String osType;

    @Valid
    private List<DeviceTagInput> tags;
}
