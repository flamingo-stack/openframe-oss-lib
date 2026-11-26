package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateUrgencyResolverTest {

    private final OsUpdateUrgencyResolver osUpdateUrgencyResolver = new OsUpdateUrgencyResolver();

    @ParameterizedTest
    @CsvSource({
            "SECURITY, CRITICAL, false, CRITICAL_SECURITY",
            "SECURITY, IMPORTANT, true, CRITICAL_SECURITY",
            "SECURITY, , true, CRITICAL_SECURITY",
            "SECURITY, IMPORTANT, false, OTHER_SECURITY",
            "SECURITY, LOW, , OTHER_SECURITY",
            "SECURITY, , , OTHER_SECURITY",
            "QUALITY, CRITICAL, true, QUALITY",
            "QUALITY, , , QUALITY"
    })
    void resolve_securityOrQualityUpdate_urgencyByClassificationSeverityAndExploitedFlag(
            OsUpdateClassification classification, OsUpdateSeverity severity, Boolean exploited,
            OsUpdateUrgency expected) {
        // setup
        OsUpdate osUpdate = OsUpdate.builder()
                .classification(classification).severity(severity).exploited(exploited).build();

        // execution
        Optional<OsUpdateUrgency> osUpdateUrgency = osUpdateUrgencyResolver.resolve(osUpdate);

        // verifications
        assertThat(osUpdateUrgency).contains(expected);
    }

    @ParameterizedTest
    @EnumSource(value = OsUpdateClassification.class, names = {"PREVIEW", "OS_VERSION", "DRIVER", "OTHER"})
    void resolve_updateNoPolicyRollsOut_empty(OsUpdateClassification classification) {
        // setup
        OsUpdate osUpdate = OsUpdate.builder()
                .classification(classification).severity(OsUpdateSeverity.CRITICAL).exploited(true).build();

        // execution
        Optional<OsUpdateUrgency> osUpdateUrgency = osUpdateUrgencyResolver.resolve(osUpdate);

        // verifications
        assertThat(osUpdateUrgency).isEmpty();
    }

    @Test
    void resolve_updateStoredBeforeClassificationExisted_empty() {
        // execution
        Optional<OsUpdateUrgency> osUpdateUrgency = osUpdateUrgencyResolver.resolve(OsUpdate.builder().build());

        // verifications
        assertThat(osUpdateUrgency).isEmpty();
    }
}
