package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.device.WipeWindowsDeviceInput;
import com.openframe.api.service.device.DeviceWipeService;
import com.openframe.data.document.device.Machine;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;

@DgsComponent
@Validated
@RequiredArgsConstructor
public class DeviceWipeDataFetcher {

    private final DeviceWipeService deviceWipeService;

    @DgsMutation
    @PreAuthorize("hasAuthority('ADMIN')")
    public Machine wipeWindowsDevice(@InputArgument @Valid WipeWindowsDeviceInput input) {
        return deviceWipeService.wipeWindowsDevice(input.getMachineId(), input.getConfirmation());
    }
}
