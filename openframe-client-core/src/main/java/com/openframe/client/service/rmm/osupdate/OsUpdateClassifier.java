package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// Windows names the class of an update by the id of a category. The ids are Microsoft's and the same on every device.
@Component
public class OsUpdateClassifier {

    private static final String SECURITY_UPDATES_CATEGORY_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String UPGRADES_CATEGORY_ID = "3689bdc8-b205-4af4-8d4a-a63924c5e9d5";
    private static final String CRITICAL_UPDATES_CATEGORY_ID = "e6cf1350-c01b-414d-a61f-263d14d133b4";
    private static final String UPDATE_ROLLUPS_CATEGORY_ID = "28bc880e-0592-4cbf-8f95-c79b17911d5f";
    private static final String UPDATES_CATEGORY_ID = "cd5ffd1e-e932-4e3a-bf74-18bf0b1bbd83";
    private static final String SERVICE_PACKS_CATEGORY_ID = "68c5b0a3-d1a6-4553-ae49-01d3a7827828";
    private static final Set<String> QUALITY_CATEGORY_IDS = Set.of(
            CRITICAL_UPDATES_CATEGORY_ID, UPDATE_ROLLUPS_CATEGORY_ID, UPDATES_CATEGORY_ID, SERVICE_PACKS_CATEGORY_ID);

    // The first rule that fits wins: a driver or a preview may also carry a security or a quality category.
    public OsUpdateClassification classify(OsUpdate osUpdate) {
        if (osUpdate.getPlatform() != OsPlatform.WINDOWS) {
            return OsUpdateClassification.OTHER;
        }
        if (osUpdate.getUpdateType() == OsUpdateType.DRIVER) {
            return OsUpdateClassification.DRIVER;
        }
        Set<String> categoryIds = findCategoryIds(osUpdate);
        if (categoryIds.contains(UPGRADES_CATEGORY_ID)) {
            return OsUpdateClassification.OS_VERSION;
        }
        if (Boolean.TRUE.equals(osUpdate.getBrowseOnly())) {
            return OsUpdateClassification.PREVIEW;
        }
        if (categoryIds.contains(SECURITY_UPDATES_CATEGORY_ID)) {
            return OsUpdateClassification.SECURITY;
        }
        if (categoryIds.stream().anyMatch(QUALITY_CATEGORY_IDS::contains)) {
            return OsUpdateClassification.QUALITY;
        }
        return OsUpdateClassification.OTHER;
    }

    // Windows gives a category id in either case.
    private static Set<String> findCategoryIds(OsUpdate osUpdate) {
        List<String> categoryIds = osUpdate.getCategoryIds();
        if (categoryIds == null) {
            return Set.of();
        }
        return categoryIds.stream()
                .filter(Objects::nonNull)
                .map(categoryId -> categoryId.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }
}
