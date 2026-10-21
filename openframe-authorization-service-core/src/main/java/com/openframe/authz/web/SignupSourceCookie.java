package com.openframe.authz.web;

import com.openframe.authz.dto.RegistrationAttribution;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.WebUtils;

import java.net.URLDecoder;

import static com.openframe.core.constants.SignupSourceParams.COOKIE;
import static com.openframe.core.constants.SignupSourceParams.DOWNLOAD_ID;
import static com.openframe.core.constants.SignupSourceParams.FBCLID;
import static com.openframe.core.constants.SignupSourceParams.GCLID;
import static com.openframe.core.constants.SignupSourceParams.LANDING_URL;
import static com.openframe.core.constants.SignupSourceParams.LI_FAT_ID;
import static com.openframe.core.constants.SignupSourceParams.RDT_CID;
import static com.openframe.core.constants.SignupSourceParams.REF;
import static com.openframe.core.constants.SignupSourceParams.REFERRER;
import static com.openframe.core.constants.SignupSourceParams.UTM_CAMPAIGN;
import static com.openframe.core.constants.SignupSourceParams.UTM_CONTENT;
import static com.openframe.core.constants.SignupSourceParams.UTM_MEDIUM;
import static com.openframe.core.constants.SignupSourceParams.UTM_SOURCE;
import static com.openframe.core.constants.SignupSourceParams.UTM_TERM;
import static java.nio.charset.StandardCharsets.UTF_8;

@Slf4j
public final class SignupSourceCookie {

    private SignupSourceCookie() {
    }

    public static RegistrationAttribution read(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, COOKIE);
        if (cookie == null || !StringUtils.hasText(cookie.getValue())) {
            return null;
        }
        try {
            MultiValueMap<String, String> params = parse(cookie.getValue());
            return RegistrationAttribution.builder()
                    .downloadId(params.getFirst(DOWNLOAD_ID))
                    .utmSource(params.getFirst(UTM_SOURCE))
                    .utmMedium(params.getFirst(UTM_MEDIUM))
                    .utmCampaign(params.getFirst(UTM_CAMPAIGN))
                    .utmContent(params.getFirst(UTM_CONTENT))
                    .utmTerm(params.getFirst(UTM_TERM))
                    .fbclid(params.getFirst(FBCLID))
                    .gclid(params.getFirst(GCLID))
                    .rdtCid(params.getFirst(RDT_CID))
                    .liFatId(params.getFirst(LI_FAT_ID))
                    .ref(params.getFirst(REF))
                    .referrer(params.getFirst(REFERRER))
                    .landingUrl(params.getFirst(LANDING_URL))
                    .build();
        } catch (IllegalArgumentException e) {
            log.warn("Unreadable {} cookie, ignoring it: {}", COOKIE, e.getMessage());
            return null;
        }
    }

    private static MultiValueMap<String, String> parse(String query) {
        MultiValueMap<String, String> decoded = new LinkedMultiValueMap<>();
        UriComponentsBuilder.newInstance().query(query).build().getQueryParams()
                .forEach((name, values) -> values.stream()
                        .filter(StringUtils::hasText)
                        .map(value -> URLDecoder.decode(value, UTF_8).trim())
                        .filter(StringUtils::hasText)
                        .forEach(value -> decoded.add(name, value)));
        return decoded;
    }
}
