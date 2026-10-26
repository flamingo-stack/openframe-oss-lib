package com.openframe.authz.dto;

import org.junit.jupiter.api.Test;

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

    @Test
    void merge_requestHasNoSourceSignal_keepsItsOwnFieldsAndTakesDownloadIdAndSourceFromCookie() {
        Touchpoint request = Touchpoint.builder()
                .fbc("fb.1.1700000000.abc")
                .hutk("hutk-1")
                .heardFrom("search")
                .referrer("https://www.reddit.com/")
                .landingUrl("https://openframe.ai/download")
                .build();

        Touchpoint merged = Touchpoint.merge(request, everyField("cookie"));

        assertThat(merged).isEqualTo(Touchpoint.builder()
                .fbc("fb.1.1700000000.abc")
                .hutk("hutk-1")
                .heardFrom("search")
                .fbclid("cookie02")
                .gclid("cookie05")
                .rdtCid("cookie06")
                .liFatId("cookie07")
                .utmSource("cookie08")
                .utmMedium("cookie09")
                .utmCampaign("cookie10")
                .utmContent("cookie11")
                .utmTerm("cookie12")
                .ref("cookie14")
                .referrer("cookie15")
                .landingUrl("cookie16")
                .downloadId("cookie17")
                .build());
    }

    @Test
    void merge_requestHasSourceSignal_keepsItsWholeSourceAndTakesOnlyDownloadIdFromCookie() {
        Touchpoint request = Touchpoint.builder()
                .utmSource("newsletter")
                .utmMedium("email")
                .build();
        Touchpoint cookie = Touchpoint.builder()
                .utmSource("google")
                .gclid("g-1")
                .landingUrl("https://openframe.ai/?gclid=g-1")
                .downloadId(DOWNLOAD_ID)
                .build();

        Touchpoint merged = Touchpoint.merge(request, cookie);

        assertThat(merged).isEqualTo(Touchpoint.builder()
                .utmSource("newsletter")
                .utmMedium("email")
                .downloadId(DOWNLOAD_ID)
                .build());
    }

    @Test
    void merge_requestHasOnlyGclid_keepsItsOwnSource() {
        Touchpoint request = Touchpoint.builder().gclid("g-1").downloadId(DOWNLOAD_ID).build();

        assertThat(Touchpoint.merge(request, everyField("cookie"))).isEqualTo(request);
    }

    @Test
    void merge_requestHasOnlyRef_keepsItsOwnSource() {
        Touchpoint request = Touchpoint.builder().ref("acme").downloadId(DOWNLOAD_ID).build();

        assertThat(Touchpoint.merge(request, everyField("cookie"))).isEqualTo(request);
    }

    @Test
    void merge_requestSourceFieldBlank_takesSourceFromCookie() {
        Touchpoint request = Touchpoint.builder().utmSource("  ").build();
        Touchpoint cookie = Touchpoint.builder().utmSource("google").gclid("g-1").build();

        assertThat(Touchpoint.merge(request, cookie)).isEqualTo(cookie);
    }

    @Test
    void merge_requestDownloadIdBlank_takesCookieDownloadId() {
        Touchpoint request = Touchpoint.builder().downloadId("  ").build();
        Touchpoint cookie = Touchpoint.builder().downloadId(DOWNLOAD_ID).build();

        assertThat(Touchpoint.merge(request, cookie).getDownloadId()).isEqualTo(DOWNLOAD_ID);
    }

    @Test
    void merge_requestNull_returnsCookie() {
        Touchpoint cookie = everyField("cookie");

        assertThat(Touchpoint.merge(null, cookie)).isSameAs(cookie);
    }

    @Test
    void merge_cookieNull_returnsRequest() {
        Touchpoint request = everyField("request");

        assertThat(Touchpoint.merge(request, null)).isSameAs(request);
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
}
