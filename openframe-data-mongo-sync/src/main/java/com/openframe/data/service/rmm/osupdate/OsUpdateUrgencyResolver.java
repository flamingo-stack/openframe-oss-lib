package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.springframework.stereotype.Component;


@Component
public class OsUpdateUrgencyResolver {

    // Null = no policy rolls the update out: a preview, a new OS version, a driver.
    public OsUpdateUrgency resolve(OsUpdate osUpdate) {
        if (osUpdate.getClassification() == OsUpdateClassification.SECURITY) {
            return isCritical(osUpdate) ? OsUpdateUrgency.CRITICAL_SECURITY : OsUpdateUrgency.OTHER_SECURITY;
        }
        if (osUpdate.getClassification() == OsUpdateClassification.QUALITY) {
            return OsUpdateUrgency.QUALITY;
        }
        return null;
    }

    private boolean isCritical(OsUpdate osUpdate) {
        return osUpdate.getSeverity() == OsUpdateSeverity.CRITICAL || Boolean.TRUE.equals(osUpdate.getExploited());
    }
}
