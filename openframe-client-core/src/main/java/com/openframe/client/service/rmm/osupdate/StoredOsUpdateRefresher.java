package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
@RequiredArgsConstructor
public class StoredOsUpdateRefresher {

    private final OsUpdateClassifier osUpdateClassifier;

    // Returns whether the stored update changed. An empty reported value never replaces a stored one.
    public boolean refresh(OsUpdate storedOsUpdate, OsUpdate reportedOsUpdate) {
        boolean filledIn = fillInCategoryIds(storedOsUpdate, reportedOsUpdate) | fillInUpdateType(storedOsUpdate, reportedOsUpdate);
        OsUpdateClassification classification = osUpdateClassifier.classify(storedOsUpdate);
        boolean reclassified = classification != storedOsUpdate.getClassification();
        storedOsUpdate.setClassification(classification);
        return filledIn || reclassified;
    }

    private static boolean fillInCategoryIds(OsUpdate storedOsUpdate, OsUpdate reportedOsUpdate) {
        boolean storedLacks = storedOsUpdate.getCategoryIds() == null || storedOsUpdate.getCategoryIds().isEmpty();
        boolean reportedHas = reportedOsUpdate.getCategoryIds() != null && !reportedOsUpdate.getCategoryIds().isEmpty();
        if (storedLacks && reportedHas) {
            storedOsUpdate.setCategoryIds(reportedOsUpdate.getCategoryIds());
            return true;
        }
        return false;
    }

    private static boolean fillInUpdateType(OsUpdate storedOsUpdate, OsUpdate reportedOsUpdate) {
        if (storedOsUpdate.getUpdateType() == null && Objects.nonNull(reportedOsUpdate.getUpdateType())) {
            storedOsUpdate.setUpdateType(reportedOsUpdate.getUpdateType());
            return true;
        }
        return false;
    }
}
