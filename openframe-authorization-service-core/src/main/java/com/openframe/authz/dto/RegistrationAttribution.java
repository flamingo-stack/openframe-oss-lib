package com.openframe.authz.dto;

import lombok.AllArgsConstructor;

import java.util.Objects;
import java.util.stream.Stream;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

/**
 * Marketing-attribution signals
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationAttribution {

    private String fbc;

    private String fbclid;

    private String fbp;

    private String hutk;

    private String gclid;

    private String rdtCid;

    private String liFatId;

    private String utmSource;
    private String utmMedium;
    private String utmCampaign;
    private String utmContent;
    private String utmTerm;

    private String eventId;

    private String ref;

    private String referrer;

    private String landingUrl;

    private String downloadId;

    private String heardFrom;

    private String heardFromOther;

    public int totalLength() {
        return Stream.of(fbc, fbclid, fbp, hutk, gclid, rdtCid, liFatId,
                        utmSource, utmMedium, utmCampaign, utmContent, utmTerm, eventId, ref,
                        referrer, landingUrl, downloadId, heardFrom, heardFromOther)
                .filter(Objects::nonNull)
                .mapToInt(String::length)
                .sum();
    }

    public static RegistrationAttribution merge(RegistrationAttribution request, RegistrationAttribution cookie) {
        if (request == null || cookie == null) {
            return request != null ? request : cookie;
        }
        RegistrationAttribution source = request.hasSourceSignal() ? request : cookie;
        return request.toBuilder()
                .downloadId(StringUtils.hasText(request.getDownloadId()) ? request.getDownloadId() : cookie.getDownloadId())
                .fbclid(source.getFbclid())
                .gclid(source.getGclid())
                .rdtCid(source.getRdtCid())
                .liFatId(source.getLiFatId())
                .utmSource(source.getUtmSource())
                .utmMedium(source.getUtmMedium())
                .utmCampaign(source.getUtmCampaign())
                .utmContent(source.getUtmContent())
                .utmTerm(source.getUtmTerm())
                .ref(source.getRef())
                .referrer(source.getReferrer())
                .landingUrl(source.getLandingUrl())
                .build();
    }

    private boolean hasSourceSignal() {
        return Stream.of(fbclid, gclid, rdtCid, liFatId, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, ref)
                .anyMatch(StringUtils::hasText);
    }
}
