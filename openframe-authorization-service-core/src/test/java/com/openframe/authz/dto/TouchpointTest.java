package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TouchpointTest {

    private static final String DOWNLOAD_ID = "0b4c5a52-6f0e-4d7b-9a3e-2f1c8d7e6b5a";

    @Test
    void totalLength_everyFieldSet_sumsTheLengthOfAllTwentyTwo() {
        Touchpoint attribution = Touchpoint.builder()
                .fbc("x01")
                .fbclid("x02")
                .fbp("x03")
                .hutk("x04")
                .gclid("x05")
                .rdtCid("x06")
                .liFatId("x07")
                .utmSource("x08")
                .utmMedium("x09")
                .utmCampaign("x10")
                .utmContent("x11")
                .utmTerm("x12")
                .eventId("x13")
                .ref("x14")
                .referrer("x15")
                .landingUrl("x16")
                .downloadId("x17")
                .heardFrom("x18")
                .heardFromOther("x19")
                .gbraid("x20")
                .wbraid("x21")
                .rdtUuid("x22")
                .build();

        assertThat(attribution.totalLength()).isEqualTo(66);
    }

    @Test
    void totalLength_someFieldsNull_sumsOnlyTheSetFields() {
        Touchpoint attribution = Touchpoint.builder()
                .referrer("https://chatgpt.com/")
                .landingUrl("https://openframe.ai/")
                .downloadId(DOWNLOAD_ID)
                .heardFrom("other")
                .heardFromOther("podcast")
                .build();

        assertThat(attribution.totalLength()).isEqualTo(89);
    }
}
