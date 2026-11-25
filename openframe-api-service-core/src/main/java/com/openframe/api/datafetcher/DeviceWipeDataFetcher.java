package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.device.DeviceWipe;
import com.openframe.api.service.device.DeviceWipeService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;

@DgsComponent
@Validated
@RequiredArgsConstructor
public class DeviceWipeDataFetcher {

    private final DeviceWipeService deviceWipeService;

    @DgsQuery
    public DeviceWipe deviceWipe(@InputArgument @NotBlank String machineId) {
        return deviceWipeService.getWipe(machineId);
    }

    @DgsMutation
    @PreAuthorize("hasAuthority('ADMIN')")
    public DeviceWipe wipeDevice(@InputArgument @NotBlank String machineId) {
        return deviceWipeService.wipe(machineId);
    }
}
