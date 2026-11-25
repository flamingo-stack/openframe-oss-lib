package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StoredOsUpdateRefresherTest {

    private static final String SECURITY_UPDATES_CATEGORY_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String UPDATES_CATEGORY_ID = "cd5ffd1e-e932-4e3a-bf74-18bf0b1bbd83";

    private StoredOsUpdateRefresher refresher;

    @BeforeEach
    void setUp() {
        refresher = new StoredOsUpdateRefresher(new OsUpdateClassifier());
    }

    @Test
    void refresh_storedAlreadyClassifiedByTheRuleAndNothingToFillIn_unchanged() {
        // setup
        OsUpdate stored = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE,
                OsUpdateClassification.SECURITY);
        OsUpdate reported = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isFalse();
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void refresh_storedClassifiedByAnEarlierRule_changedToTheClassOfTheCurrentRule() {
        // setup
        OsUpdate stored = osUpdate(List.of(UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, OsUpdateClassification.OTHER);
        OsUpdate reported = osUpdate(List.of(UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isTrue();
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.QUALITY);
    }

    @Test
    void refresh_storedWithoutAClassification_classified() {
        // setup
        OsUpdate stored = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);
        OsUpdate reported = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isTrue();
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void refresh_storedByAnOldAgentWithoutCategoryIdsAndUpdateType_filledInFromTheReportAndReclassified() {
        // setup
        OsUpdate stored = osUpdate(List.of(), null, OsUpdateClassification.OTHER);
        OsUpdate reported = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isTrue();
        assertThat(stored.getCategoryIds()).containsExactly(SECURITY_UPDATES_CATEGORY_ID);
        assertThat(stored.getUpdateType()).isEqualTo(OsUpdateType.SOFTWARE);
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void refresh_storedCategoryIdsNull_filledInFromTheReport() {
        // setup
        OsUpdate stored = osUpdate(null, OsUpdateType.SOFTWARE, OsUpdateClassification.OTHER);
        OsUpdate reported = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isTrue();
        assertThat(stored.getCategoryIds()).containsExactly(SECURITY_UPDATES_CATEGORY_ID);
    }

    @Test
    void refresh_storedUpdateTypeOnlyMissing_filledInAndUnchangedClassStillCountsAsChanged() {
        // setup
        OsUpdate stored = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), null, OsUpdateClassification.SECURITY);
        OsUpdate reported = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isTrue();
        assertThat(stored.getUpdateType()).isEqualTo(OsUpdateType.SOFTWARE);
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void refresh_reportWithoutCategoryIdsAndUpdateType_storedValuesKept() {
        // setup
        OsUpdate stored = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE,
                OsUpdateClassification.SECURITY);
        OsUpdate reportedEmpty = osUpdate(List.of(), null, null);
        OsUpdate reportedNull = osUpdate(null, null, null);

        // execution
        boolean changedByEmpty = refresher.refresh(stored, reportedEmpty);
        boolean changedByNull = refresher.refresh(stored, reportedNull);

        // verifications
        assertThat(changedByEmpty).isFalse();
        assertThat(changedByNull).isFalse();
        assertThat(stored.getCategoryIds()).containsExactly(SECURITY_UPDATES_CATEGORY_ID);
        assertThat(stored.getUpdateType()).isEqualTo(OsUpdateType.SOFTWARE);
        assertThat(stored.getClassification()).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void refresh_reportWithOtherCategoryIdsAndUpdateType_storedNonEmptyValuesNotOverwritten() {
        // setup
        OsUpdate stored = osUpdate(List.of(SECURITY_UPDATES_CATEGORY_ID), OsUpdateType.SOFTWARE,
                OsUpdateClassification.SECURITY);
        OsUpdate reported = osUpdate(List.of(UPDATES_CATEGORY_ID), OsUpdateType.DRIVER, null);

        // execution
        boolean changed = refresher.refresh(stored, reported);

        // verifications
        assertThat(changed).isFalse();
        assertThat(stored.getCategoryIds()).containsExactly(SECURITY_UPDATES_CATEGORY_ID);
        assertThat(stored.getUpdateType()).isEqualTo(OsUpdateType.SOFTWARE);
    }

    private static OsUpdate osUpdate(List<String> categoryIds, OsUpdateType updateType,
                                     OsUpdateClassification classification) {
        return OsUpdate.builder()
                .tenantId("tenant-1")
                .platform(OsPlatform.WINDOWS)
                .identifier("kb-1")
                .categoryIds(categoryIds)
                .updateType(updateType)
                .classification(classification)
                .build();
    }
}
