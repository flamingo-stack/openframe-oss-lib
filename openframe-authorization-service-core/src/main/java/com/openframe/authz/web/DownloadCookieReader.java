package com.openframe.authz.web;

import com.openframe.authz.dto.Touchpoint;
import com.openframe.authz.dto.Visit;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.WebUtils;

import java.net.URLDecoder;

import static com.openframe.core.constants.DownloadParams.COOKIE;
import static com.openframe.core.constants.DownloadParams.DOWNLOAD_ID;
import static com.openframe.core.constants.DownloadParams.FBC;
import static com.openframe.core.constants.DownloadParams.FBCLID;
import static com.openframe.core.constants.DownloadParams.FBP;
import static com.openframe.core.constants.DownloadParams.GBRAID;
import static com.openframe.core.constants.DownloadParams.GCLID;
import static com.openframe.core.constants.DownloadParams.LANDED_AT;
import static com.openframe.core.constants.DownloadParams.LANDING_URL;
import static com.openframe.core.constants.DownloadParams.LI_FAT_ID;
import static com.openframe.core.constants.DownloadParams.RDT_CID;
import static com.openframe.core.constants.DownloadParams.RDT_UUID;
import static com.openframe.core.constants.DownloadParams.REF;
import static com.openframe.core.constants.DownloadParams.REFERRER;
import static com.openframe.core.constants.DownloadParams.UTM_CAMPAIGN;
import static com.openframe.core.constants.DownloadParams.UTM_CONTENT;
import static com.openframe.core.constants.DownloadParams.UTM_MEDIUM;
import static com.openframe.core.constants.DownloadParams.UTM_SOURCE;
import static com.openframe.core.constants.DownloadParams.UTM_TERM;
import static com.openframe.core.constants.DownloadParams.WBRAID;
import static java.nio.charset.StandardCharsets.UTF_8;

@Slf4j
public final class DownloadCookieReader {

    private DownloadCookieReader() {
    }

    public static Touchpoint read(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, COOKIE);
        if (cookie == null || !StringUtils.hasText(cookie.getValue())) {
            return null;
        }
        try {
            MultiValueMap<String, String> params = parse(cookie.getValue());
            return Touchpoint.builder()
                    .downloadId(params.getFirst(DOWNLOAD_ID))
                    .lastVisit(Visit.builder()
                            .utmSource(params.getFirst(UTM_SOURCE))
                            .utmMedium(params.getFirst(UTM_MEDIUM))
                            .utmCampaign(params.getFirst(UTM_CAMPAIGN))
                            .utmContent(params.getFirst(UTM_CONTENT))
                            .utmTerm(params.getFirst(UTM_TERM))
                            .fbclid(params.getFirst(FBCLID))
                            .gclid(params.getFirst(GCLID))
                            .gbraid(params.getFirst(GBRAID))
                            .wbraid(params.getFirst(WBRAID))
                            .rdtCid(params.getFirst(RDT_CID))
                            .liFatId(params.getFirst(LI_FAT_ID))
                            .referrer(params.getFirst(REFERRER))
                            .landingUrl(params.getFirst(LANDING_URL))
                            .landedAt(landedAt(params.getFirst(LANDED_AT)))
                            .build())
                    .fbc(params.getFirst(FBC))
                    .fbp(params.getFirst(FBP))
                    .rdtUuid(params.getFirst(RDT_UUID))
                    .ref(params.getFirst(REF))
                    .build();
        } catch (IllegalArgumentException e) {
            log.warn("Unreadable {} cookie, ignoring it: {}", COOKIE, e.getMessage());
            return null;
        }
    }

    private static Long landedAt(String value) {
        return value == null ? null : Long.valueOf(value);
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
