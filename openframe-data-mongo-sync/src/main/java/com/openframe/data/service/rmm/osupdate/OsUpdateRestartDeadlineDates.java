package com.openframe.data.service.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class OsUpdateRestartDeadlineDates {

    Instant focusAt;

    Instant softAt;

    Instant hardAt;
}
