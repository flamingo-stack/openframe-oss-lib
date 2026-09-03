package com.openframe.data.nats.model;

import lombok.Data;

@Data
public class MachineTimezoneRequestMessage {

    private String scheduleId;
    private String requestedAt;
}
