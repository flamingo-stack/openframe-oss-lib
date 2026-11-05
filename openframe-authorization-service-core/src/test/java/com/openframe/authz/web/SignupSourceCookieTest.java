package com.openframe.authz.web;

import com.openframe.authz.dto.Touchpoint;
import com.openframe.authz.dto.Visit;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class SignupSourceCookieTest {

    private static final String DOWNLOAD_ID = "0b6f4c1e-9d2a-4f3b-8c7d-5e6f7a8b9c0d";

    @Test
    void read_noSourceCookie_returnsNull() {
        assertThat(SignupSourceCookie.read(new MockHttpServletRequest())).isNull();
    }

    @Test
    void read_emptyCookie_returnsNull() {
        assertThat(SignupSourceCookie.read(withCookie(""))).isNull();
    }

    @Test
    void read_gatewayCookie_mapsTheVisitTheBrowserIdsAndTheDownloadId() {
        Touchpoint attribution = SignupSourceCookie.read(withCookie("id=" + DOWNLOAD_ID
                + "&utm_source=google&utm_medium=cpc&utm_campaign=spring-launch&utm_content=hero-banner"
                + "&utm_term=rmm-software&fbclid=IwAR0fb&gclid=Cj0KCQg&rdt_cid=t2-rdt&li_fat_id=li-fat-7"
                + "&ref=acme-msp&referrer=www.google.com&landing_url=openframe.ai"
                + "&gbraid=0AAAAApQxGbRaId&wbraid=CjkKCQjwWbRaId&fbc=fb.1.1729900000000.IwAR2FbClickId"
                + "&fbp=fb.1.1729900000000.1234567890&rdt_uuid=1729900000000.6F1C2B3A-4d5e-6f70-8192-A3B4C5D6E7F8"
                + "&landed_at=1729900000000"));

        assertThat(attribution).isEqualTo(Touchpoint.builder()
                .downloadId(DOWNLOAD_ID)
                .lastVisit(Visit.builder()
                        .utmSource("google")
                        .utmMedium("cpc")
                        .utmCampaign("spring-launch")
                        .utmContent("hero-banner")
                        .utmTerm("rmm-software")
                        .fbclid("IwAR0fb")
                        .gclid("Cj0KCQg")
                        .rdtCid("t2-rdt")
                        .liFatId("li-fat-7")
                        .referrer("www.google.com")
                        .landingUrl("openframe.ai")
                        .gbraid("0AAAAApQxGbRaId")
                        .wbraid("CjkKCQjwWbRaId")
                        .landedAt(1729900000000L)
                        .build())
                .ref("acme-msp")
                .fbc("fb.1.1729900000000.IwAR2FbClickId")
                .fbp("fb.1.1729900000000.1234567890")
                .rdtUuid("1729900000000.6F1C2B3A-4d5e-6f70-8192-A3B4C5D6E7F8")
                .build());
    }

    @Test
    void read_encodedValue_returnsItDecoded() {
        Touchpoint attribution = SignupSourceCookie.read(withCookie(
                "landing_url=https%3A%2F%2Fopenframe.ai%2Fsignup%3Fplan%3Dpro%26q%3Dc%2B%2B%26promo%3D50%25+off"));

        assertThat(attribution).isEqualTo(visitOnly(Visit.builder()
                .landingUrl("https://openframe.ai/signup?plan=pro&q=c++&promo=50% off")
                .build()));
    }

    @Test
    void read_valueWithSurroundingSpaces_returnsItTrimmed() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=+google+")))
                .isEqualTo(visitOnly(Visit.builder().utmSource("google").build()));
    }

    @Test
    void read_blankValue_leavesTheFieldNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=+&utm_medium=cpc")))
                .isEqualTo(visitOnly(Visit.builder().utmMedium("cpc").build()));
    }

    @Test
    void read_parameterWithoutValue_leavesTheFieldNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source&utm_medium=cpc")))
                .isEqualTo(visitOnly(Visit.builder().utmMedium("cpc").build()));
    }

    @Test
    void read_brokenEscapeInValue_returnsNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=google%zz"))).isNull();
    }

    @Test
    void read_unreadableVisitTime_returnsNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=google&landed_at=yesterday"))).isNull();
    }

    private static Touchpoint visitOnly(Visit visit) {
        return Touchpoint.builder().lastVisit(visit).build();
    }

    private static MockHttpServletRequest withCookie(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("of_src", value));
        return request;
    }
}
