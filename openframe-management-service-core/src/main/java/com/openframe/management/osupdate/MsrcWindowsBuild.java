package com.openframe.management.osupdate;

import lombok.Builder;
import lombok.Value;

// The fixes one monthly MSRC bulletin names for a Windows version, as builds with their revision ("26100.9974").
@Value
@Builder
public class MsrcWindowsBuild {

    // Of the latest cumulative security update.
    String latestBuild;
    // Of the hotpatch that fixes the same vulnerabilities as latestBuild without a restart. Null = the latest
    // cumulative update has no hotpatch: a baseline month, or a version without hotpatching.
    String hotpatchBuild;
}
