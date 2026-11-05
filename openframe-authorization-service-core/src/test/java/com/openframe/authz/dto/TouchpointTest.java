package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class TouchpointTest {

    private static final String DOWNLOAD_ID = "0b4c5a52-6f0e-4d7b-9a3e-2f1c8d7e6b5a";

    private static Touchpoint everyField(String prefix) {
        return Touchpoint.builder()
                .fbc(prefix + "01")
                .fbclid(prefix + "02")
                .fbp(prefix + "03")
                .hutk(prefix + "04")
                .gclid(prefix + "05")
                .rdtCid(prefix + "06")
                .liFatId(prefix + "07")
                .utmSource(prefix + "08")
                .utmMedium(prefix + "09")
                .utmCampaign(prefix + "10")
                .utmContent(prefix + "11")
                .utmTerm(prefix + "12")
                .eventId(prefix + "13")
                .ref(prefix + "14")
                .referrer(prefix + "15")
                .landingUrl(prefix + "16")
                .downloadId(prefix + "17")
                .heardFrom(prefix + "18")
                .heardFromOther(prefix + "19")
                .build();
    }

    private static Stream<Touchpoint> requestsWithOnlyGbraidOrWbraid() {
        return Stream.of(
                Touchpoint.builder().gbraid("gb-1").build(),
                Touchpoint.builder().wbraid("wb-1").build());
    }

    @Test
    void totalLength_everyFieldSet_sumsTheLengthOfAllNineteen() {
        assertThat(everyField("x").totalLength()).isEqualTo(57);
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

    @Test
    void totalLength_gbraidWbraidAndRdtUuidSet_countsThem() {
        Touchpoint attribution = Touchpoint.builder()
                .gbraid("gb-1")
                .wbraid("wb-12")
                .rdtUuid("uuid-123")
                .build();

        assertThat(attribution.totalLength()).isEqualTo(17);
    }
}
