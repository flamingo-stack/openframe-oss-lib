package com.openframe.api.service.rmm.osupdate.release;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class WindowsRelease {

    private String cycle;
    private String releaseLabel;
    private String latestBuild;
    private LocalDate endOfSupportAt;
}
