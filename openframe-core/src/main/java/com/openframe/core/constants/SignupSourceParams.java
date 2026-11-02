package com.openframe.core.constants;

import java.util.List;

public final class SignupSourceParams {

    private SignupSourceParams() {
    }

    public static final String COOKIE = "of_src";

    public static final String DOWNLOAD_ID = "id";
    public static final String UTM_SOURCE = "utm_source";
    public static final String UTM_MEDIUM = "utm_medium";
    public static final String UTM_CAMPAIGN = "utm_campaign";
    public static final String UTM_CONTENT = "utm_content";
    public static final String UTM_TERM = "utm_term";
    public static final String FBCLID = "fbclid";
    public static final String GCLID = "gclid";
    public static final String RDT_CID = "rdt_cid";
    public static final String LI_FAT_ID = "li_fat_id";
    public static final String REF = "ref";
    public static final String REFERRER = "referrer";
    public static final String LANDING_URL = "landing_url";

    public static final List<String> SOURCE = List.of(UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN, UTM_CONTENT, UTM_TERM,
            FBCLID, GCLID, RDT_CID, LI_FAT_ID, REF, REFERRER, LANDING_URL);
    public static final List<String> URLS = List.of(REFERRER, LANDING_URL);
}
