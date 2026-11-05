package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Objects;
import java.util.stream.Stream;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Visit {

    private String utmSource;
    private String utmMedium;
    private String utmCampaign;
    private String utmContent;
    private String utmTerm;
    private String fbclid;
    private String gclid;
    private String gbraid;
    private String wbraid;
    private String rdtCid;
    private String liFatId;
    private String referrer;
    private String landingUrl;
    private Long landedAt;

    public int totalLength() {
        return Stream.of(utmSource, utmMedium, utmCampaign, utmContent, utmTerm, fbclid, gclid, gbraid, wbraid, rdtCid,
                        liFatId, referrer, landingUrl, Objects.toString(landedAt, null))
                .filter(Objects::nonNull)
                .mapToInt(String::length)
                .sum();
    }

    public Visit withoutUrls() {
        return toBuilder().referrer(null).landingUrl(null).build();
    }
}
