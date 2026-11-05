package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    /**
     * A click id. Someone taps a Google ad on the web and the ad opens the advertiser's own iPhone app instead of a
     * website.
     */
    private String gbraid;
    /**
     * A click id. Someone taps a Google ad inside one of Google's iPhone apps (YouTube, the Google app, Gmail) and
     * lands on a website. Google puts wbraid in the website link instead of gclid.
     */
    private String wbraid;
    private String rdtCid;
    private String liFatId;
    /**
     * The page the browser came from ({@code https://www.google.com/}). The frontend reads it from the browser and
     * sends it. Google → organic search, chatgpt.com → AI search, another site → referral.
     */
    private String referrer;
    private String landingUrl;
    private Long landedAt;
}
