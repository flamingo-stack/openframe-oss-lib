package com.openframe.authz.dto;

import lombok.AllArgsConstructor;

import java.util.Objects;
import java.util.stream.Stream;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Marketing-attribution signals
 */
@Data
@Builder
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

    public int totalLength() {
        return Stream.of(fbc, fbclid, fbp, hutk, gclid, rdtCid, liFatId,
                        utmSource, utmMedium, utmCampaign, utmContent, utmTerm, eventId, ref)
                .filter(Objects::nonNull)
                .mapToInt(String::length)
                .sum();
    }
}
