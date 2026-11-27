package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class OsUpdateReleasedAtResolver {

    // The vendor does not date every update: such an update counts from the first report of it in the tenant.
    public Instant resolve(OsUpdate osUpdate) {
        return osUpdate.getPublishedAt() != null ? osUpdate.getPublishedAt() : osUpdate.getFirstSeenAt();
    }
}
