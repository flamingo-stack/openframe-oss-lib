package com.openframe.api.dto.device;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WipeWindowsDeviceInput {
    @NotBlank
    private String machineId;
    @NotBlank
    private String confirmation;
}
