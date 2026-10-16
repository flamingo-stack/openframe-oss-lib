package com.openframe.authz.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.authz.dto.RegistrationAttribution;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.STRING;

class SignupSourceCookieTest {

    private static final String DOWNLOAD_ID = "0b6f4c1e-9d2a-4f3b-8c7d-5e6f7a8b9c0d";

    private final Logger logger = (Logger) LoggerFactory.getLogger(SignupSourceCookie.class);

    @AfterEach
    void resetLogger() {
        logger.detachAndStopAllAppenders();
        logger.setLevel(null);
    }

    @Test
    void read_noSourceCookie_returnsNull() {
        assertThat(SignupSourceCookie.read(new MockHttpServletRequest())).isNull();
    }

    @Test
    void read_emptyCookie_returnsNull() {
        assertThat(SignupSourceCookie.read(withCookie(""))).isNull();
    }

    @Test
    void read_gatewayCookie_mapsEverySourceFieldAndTheDownloadId() {
        RegistrationAttribution attribution = SignupSourceCookie.read(withCookie("id=" + DOWNLOAD_ID
                + "&utm_source=google&utm_medium=cpc&utm_campaign=spring-launch&utm_content=hero-banner"
                + "&utm_term=rmm-software&fbclid=IwAR0fb&gclid=Cj0KCQg&rdt_cid=t2-rdt&li_fat_id=li-fat-7"
                + "&ref=acme-msp&referrer=www.google.com&landing_url=openframe.ai"));

        assertThat(attribution).isEqualTo(RegistrationAttribution.builder()
                .downloadId(DOWNLOAD_ID)
                .utmSource("google")
                .utmMedium("cpc")
                .utmCampaign("spring-launch")
                .utmContent("hero-banner")
                .utmTerm("rmm-software")
                .fbclid("IwAR0fb")
                .gclid("Cj0KCQg")
                .rdtCid("t2-rdt")
                .liFatId("li-fat-7")
                .ref("acme-msp")
                .referrer("www.google.com")
                .landingUrl("openframe.ai")
                .build());
    }

    @Test
    void read_encodedValue_returnsItDecoded() {
        RegistrationAttribution attribution = SignupSourceCookie.read(withCookie(
                "landing_url=https%3A%2F%2Fopenframe.ai%2Fsignup%3Fplan%3Dpro%26q%3Dc%2B%2B%26promo%3D50%25+off"));

        assertThat(attribution).isEqualTo(RegistrationAttribution.builder()
                .landingUrl("https://openframe.ai/signup?plan=pro&q=c++&promo=50% off")
                .build());
    }

    @Test
    void read_valueWithSurroundingSpaces_returnsItTrimmed() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=+google+")))
                .isEqualTo(RegistrationAttribution.builder().utmSource("google").build());
    }

    @Test
    void read_blankValue_leavesTheFieldNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source=+&utm_medium=cpc")))
                .isEqualTo(RegistrationAttribution.builder().utmMedium("cpc").build());
    }

    @Test
    void read_parameterWithoutValue_leavesTheFieldNull() {
        assertThat(SignupSourceCookie.read(withCookie("utm_source&utm_medium=cpc")))
                .isEqualTo(RegistrationAttribution.builder().utmMedium("cpc").build());
    }

    @Test
    void read_brokenEscapeInValue_warnsAndReturnsNull() {
        ListAppender<ILoggingEvent> logs = captureWarnings();

        assertThat(SignupSourceCookie.read(withCookie("utm_source=google%zz"))).isNull();
        assertThat(logs.list).singleElement()
                .returns(Level.WARN, ILoggingEvent::getLevel)
                .extracting(ILoggingEvent::getFormattedMessage, as(STRING))
                .startsWith("Unreadable of_src cookie, ignoring it: ");
    }

    private ListAppender<ILoggingEvent> captureWarnings() {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.WARN);
        return appender;
    }

    private static MockHttpServletRequest withCookie(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("of_src", value));
        return request;
    }
}
