package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class UpdateDeviceNicknameRequest {
    @Schema(description = "User-defined nickname for the device. Null or empty clears it.",
            example = "Reception iMac")
    private String nickname;
}

