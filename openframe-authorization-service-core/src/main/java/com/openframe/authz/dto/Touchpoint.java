package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * What a browser tells about where the visitor came from: the first visit it saw, the last visit (the one this
 * request happens on: the signup, the download or the "email me the link" request), each ad platform's latest click,
 * and the Meta, Reddit and HubSpot cookies. A signup can have several, one per request; SignupAttribution merges them
 * by time.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Touchpoint {

    private Visit firstVisit;

    private Visit lastVisit;

    private LatestClicks latestClicks;

    private String fbc;

    private String fbp;

    private String hutk;

    /** The value of Reddit's {@code _rdt_uuid} cookie. */
    private String rdtUuid;

    private String eventId;

    /**
     * A partner code in the link ({@code ?ref=acme}). Marketing gives each partner a code; a matching code makes
     * the channel {@code partner}.
     */
    private String ref;

    private String downloadId;

    /**
     * The answer picked in the app's "How did you hear about us?" list ({@code search}, {@code ai},
     * {@code producthunt}, {@code social_ad}, {@code newsletter}, {@code friend}, {@code partner}, {@code other}).
     * Used only when nothing else says where the person came from.
     */
    private String heardFrom;

    /** The free text typed when the answer is {@code other}. Sent to HubSpot as the source. */
    private String heardFromOther;
}
