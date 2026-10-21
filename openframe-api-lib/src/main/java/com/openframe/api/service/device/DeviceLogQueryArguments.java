package com.openframe.api.service.device;

import lombok.Value;
import lombok.experimental.Accessors;

import java.time.Instant;
import java.util.List;

/** Carries device-log filters and a decoded cursor through the shared pure argument checks. */
@Value
@Accessors(fluent = true)
public class DeviceLogQueryArguments {

    private final List<String> machineIds;
    private final List<String> organizationIds;
    private final List<String> contains;
    private final List<String> excludes;
    private final Instant from;
    private final Instant to;
    private final String cursor;

}
