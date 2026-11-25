package com.openframe.api.service.rmm.osupdate.release;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class WindowsRelease {

    String cycle;
    String releaseLabel;
    String latestBuild;
    LocalDate endOfSupportAt;
}
