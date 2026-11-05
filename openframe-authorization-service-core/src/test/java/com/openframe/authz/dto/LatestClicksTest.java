package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LatestClicksTest {

    @Test
    void totalLength_everyPlatformClicked_sumsTheLengthOfAllFourClicks() {
        LatestClicks clicks = LatestClicks.builder()
                .meta(Click.builder().fbclid("ab").clickedAt(12L).build())
                .google(Click.builder().gclid("cde").build())
                .reddit(Click.builder().rdtCid("f").build())
                .linkedin(Click.builder().liFatId("gh").build())
                .build();

        assertThat(clicks.totalLength()).isEqualTo(10);
    }

    @Test
    void totalLength_onlyOnePlatformClicked_sumsThatClick() {
        LatestClicks clicks = LatestClicks.builder().reddit(Click.builder().rdtCid("rdt-1").build()).build();

        assertThat(clicks.totalLength()).isEqualTo(5);
    }
}
