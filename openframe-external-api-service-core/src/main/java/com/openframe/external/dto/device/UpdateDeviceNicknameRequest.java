package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;

public record UpdateDeviceNicknameRequest(
        @Schema(description = "User-defined nickname for the device. Null or empty clears it.",
                example = "Reception iMac")
        String nickname
) {}
