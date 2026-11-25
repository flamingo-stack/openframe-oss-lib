package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateClassifierTest {

    private static final String SECURITY_UPDATES = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String UPGRADES = "3689bdc8-b205-4af4-8d4a-a63924c5e9d5";
    private static final String UPDATES = "cd5ffd1e-e932-4e3a-bf74-18bf0b1bbd83";
    private static final String WINDOWS_11_PRODUCT = "72e7624a-5b00-45d2-b92f-e561c0a6a160";

    private OsUpdateClassifier classifier;
    private OsUpdate osUpdate;

    @BeforeEach
    void setUp() {
        classifier = new OsUpdateClassifier();
        osUpdate = OsUpdate.builder()
                .platform(OsPlatform.WINDOWS)
                .identifier("a1b2c3d4-0000-4444-8888-99aabbccddee:201")
                .build();
    }

    @ParameterizedTest
    @CsvSource({
            "0fa1201d-4330-4fa8-8ae9-b877473b6441, SECURITY",
            "0FA1201D-4330-4FA8-8AE9-B877473B6441, SECURITY",
            "3689bdc8-b205-4af4-8d4a-a63924c5e9d5, OS_VERSION",
            "e6cf1350-c01b-414d-a61f-263d14d133b4, QUALITY",
            "28bc880e-0592-4cbf-8f95-c79b17911d5f, QUALITY",
            "cd5ffd1e-e932-4e3a-bf74-18bf0b1bbd83, QUALITY",
            "CD5FFD1E-E932-4E3A-BF74-18BF0B1BBD83, QUALITY",
            "68c5b0a3-d1a6-4553-ae49-01d3a7827828, QUALITY",
            "b54e7d24-7add-428f-8b75-90a396fa584f, OTHER",
            "b4832bd8-e735-4761-8daf-37f882276dab, OTHER",
            "e0789628-ce08-4437-be74-2495b842f43b, OTHER",
            "72e7624a-5b00-45d2-b92f-e561c0a6a160, OTHER"
    })
    void classify_windowsUpdateOfOneCategory_classOfThatCategoryWhateverTheCaseOfItsId(
            String categoryId, OsUpdateClassification expected) {
        // setup
        osUpdate.setCategoryIds(List.of(WINDOWS_11_PRODUCT, categoryId));

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(expected);
    }

    @Test
    void classify_driverUpdate_driverEvenWithASecurityCategoryAndBrowseOnly() {
        // setup
        osUpdate.setUpdateType(OsUpdateType.DRIVER);
        osUpdate.setCategoryIds(List.of(SECURITY_UPDATES));
        osUpdate.setBrowseOnly(true);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.DRIVER);
    }

    @Test
    void classify_upgradeThatIsBrowseOnly_osVersion() {
        // setup
        osUpdate.setUpdateType(OsUpdateType.SOFTWARE);
        osUpdate.setCategoryIds(List.of(UPGRADES));
        osUpdate.setBrowseOnly(true);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.OS_VERSION);
    }

    @ParameterizedTest
    @CsvSource({
            "0fa1201d-4330-4fa8-8ae9-b877473b6441",
            "cd5ffd1e-e932-4e3a-bf74-18bf0b1bbd83",
            "72e7624a-5b00-45d2-b92f-e561c0a6a160"
    })
    void classify_browseOnlyUpdate_previewWhateverItsCategory(String categoryId) {
        // setup
        osUpdate.setCategoryIds(List.of(categoryId));
        osUpdate.setBrowseOnly(true);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.PREVIEW);
    }

    @Test
    void classify_securityAndQualityCategoriesTogether_security() {
        // setup
        osUpdate.setCategoryIds(List.of(UPDATES, SECURITY_UPDATES));
        osUpdate.setBrowseOnly(false);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void classify_noCategoryIdsAtAll_other() {
        // setup
        osUpdate.setCategoryIds(null);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.OTHER);
    }

    @Test
    void classify_nullAmongTheCategoryIds_ignored() {
        // setup
        osUpdate.setCategoryIds(Arrays.asList(null, SECURITY_UPDATES));

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.SECURITY);
    }

    @Test
    void classify_macUpdate_otherWhateverItCarries() {
        // setup
        osUpdate.setPlatform(OsPlatform.MACOS);
        osUpdate.setCategoryIds(List.of(SECURITY_UPDATES));
        osUpdate.setUpdateType(OsUpdateType.DRIVER);

        // execution
        OsUpdateClassification classification = classifier.classify(osUpdate);

        // verifications
        assertThat(classification).isEqualTo(OsUpdateClassification.OTHER);
    }
}
