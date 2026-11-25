package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import lombok.Builder;
import lombok.Value;

import java.util.Collection;
import java.util.List;

@Value
@Builder(toBuilder = true)
public class OsUpdateFilter {

    public static final OsUpdateFilter NONE = OsUpdateFilter.builder().build();

    OsPlatform platform;
    List<OsUpdateClassification> classifications;
    String search;
    // null = every update; empty = none
    Collection<String> osUpdateIds;
}
