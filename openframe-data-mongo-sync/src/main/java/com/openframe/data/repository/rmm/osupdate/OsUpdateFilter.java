package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class OsUpdateFilter {

    public static final OsUpdateFilter NONE = OsUpdateFilter.builder().build();

    OsPlatform platform;
    List<OsUpdateClassification> classifications;
    String search;
}
