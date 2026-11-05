package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TouchpointTest {

    private static final String DOWNLOAD_ID = "0b4c5a52-6f0e-4d7b-9a3e-2f1c8d7e6b5a";

    @Test
    void totalLength_everyFlatFieldWithVisitsAndClicks_sumsAllOfThem() {
        Touchpoint touchpoint = Touchpoint.builder()
                .fbc("x01")
                .fbp("x02")
                .hutk("x03")
                .rdtUuid("x04")
                .eventId("x05")
                .ref("x06")
                .downloadId("x07")
                .heardFrom("x08")
                .heardFromOther("x09")
                .firstVisit(Visit.builder().utmSource("reddit").build())
                .lastVisit(Visit.builder().gclid("g-1").build())
                .latestClicks(LatestClicks.builder().meta(Click.builder().fbclid("fb-1").build()).build())
                .build();

        assertThat(touchpoint.totalLength()).isEqualTo(40);
    }

    @Test
    void totalLength_noVisitsAndNoClicks_sumsOnlyTheSetFields() {
        Touchpoint touchpoint = Touchpoint.builder()
                .downloadId(DOWNLOAD_ID)
                .heardFrom("other")
                .heardFromOther("podcast")
                .build();

        assertThat(touchpoint.totalLength()).isEqualTo(48);
    }

    @Test
    void withoutUrls_lastVisitWithUrls_dropsItsReferrerAndLandingUrl() {
        Touchpoint touchpoint = Touchpoint.builder()
                .downloadId(DOWNLOAD_ID)
                .lastVisit(Visit.builder()
                        .utmSource("google")
                        .referrer("https://www.google.com/")
                        .landingUrl("https://openframe.ai/pricing")
                        .build())
                .build();

        assertThat(touchpoint.withoutUrls()).isEqualTo(Touchpoint.builder()
                .downloadId(DOWNLOAD_ID)
                .lastVisit(Visit.builder().utmSource("google").build())
                .build());
    }

    @Test
    void withoutUrls_noLastVisit_returnsTheSameFields() {
        Touchpoint touchpoint = Touchpoint.builder().downloadId(DOWNLOAD_ID).build();

        assertThat(touchpoint.withoutUrls()).isEqualTo(touchpoint);
    }
}
