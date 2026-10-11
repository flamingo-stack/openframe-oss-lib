package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UpdateDeviceNicknameRequest {
    @Schema(description = "User-defined nickname for the device. Null or empty clears it.",
            example = "Reception iMac")
    private final String nickname;
}

