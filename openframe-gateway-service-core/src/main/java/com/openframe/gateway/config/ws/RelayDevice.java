package com.openframe.gateway.config.ws;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RelayDevice {

    private final String tenantId;
    private final String machineId;
}
