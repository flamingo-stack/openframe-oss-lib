package com.openframe.api.dataloader;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class OsUpdateDeviceCountsKey {

    String osUpdateId;
    // empty = every organization
    List<String> organizationIds;
}
