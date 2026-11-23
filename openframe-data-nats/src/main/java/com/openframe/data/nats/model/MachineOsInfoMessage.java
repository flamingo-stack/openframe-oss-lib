package com.openframe.data.nats.model;

import lombok.Data;

@Data
public class MachineOsInfoMessage {

    public static final String STREAM = "MACHINE_OS_INFO";
    public static final String SUBJECT_FILTER = "machine.*.os-info";

    private String osVersion;
    private String osBuild;
}
