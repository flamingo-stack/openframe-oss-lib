package com.openframe.management.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;

import java.time.Instant;
import java.util.List;

public interface OsUpdateEnricher {

    boolean applicableTo(OsUpdate osUpdate);

    // Sets enrichedAt on every update it could check, with or without data; the rest are left for the next run.
    void enrich(List<OsUpdate> osUpdates, Instant enrichedAt);
}
