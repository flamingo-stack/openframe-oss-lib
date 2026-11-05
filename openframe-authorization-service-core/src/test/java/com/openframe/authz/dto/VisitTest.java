package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VisitTest {

    @Test
    void totalLength_everyFieldSet_sumsTheLengthOfAllFourteen() {
        Visit visit = Visit.builder()
                .utmSource("x01")
                .utmMedium("x02")
                .utmCampaign("x03")
                .utmContent("x04")
                .utmTerm("x05")
                .fbclid("x06")
                .gclid("x07")
                .gbraid("x08")
                .wbraid("x09")
                .rdtCid("x10")
                .liFatId("x11")
                .referrer("x12")
                .landingUrl("x13")
                .landedAt(1234L)
                .build();

        assertThat(visit.totalLength()).isEqualTo(43);
    }

    @Test
    void withoutUrls_visitWithUrls_dropsReferrerAndLandingUrl() {
        Visit visit = Visit.builder()
                .utmSource("google")
                .referrer("https://www.google.com/")
                .landingUrl("https://openframe.ai/pricing")
                .landedAt(1234L)
                .build();

        assertThat(visit.withoutUrls()).isEqualTo(Visit.builder().utmSource("google").landedAt(1234L).build());
    }
}
