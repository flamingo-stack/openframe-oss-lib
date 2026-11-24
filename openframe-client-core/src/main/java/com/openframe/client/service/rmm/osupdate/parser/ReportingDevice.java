package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ReportingDevice {

    String tenantId;

    String machineId;

    OsPlatform platform;

    Instant receivedAt;
}
