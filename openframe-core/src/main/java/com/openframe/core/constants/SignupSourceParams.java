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
    public static final String GBRAID = "gbraid";
    public static final String WBRAID = "wbraid";
    public static final String RDT_CID = "rdt_cid";
    public static final String LI_FAT_ID = "li_fat_id";
    public static final String FBC = "fbc";
    public static final String FBP = "fbp";
    public static final String RDT_UUID = "rdt_uuid";
    public static final String REF = "ref";
    public static final String REFERRER = "referrer";
    public static final String LANDING_URL = "landing_url";
    public static final String LANDED_AT = "landed_at";
    public static final String CLICKED_AT = "clicked_at";
    public static final String FIRST_VISIT = "first_visit";
    public static final String LAST_VISIT = "last_visit";
    public static final String LATEST_CLICKS = "latest_clicks";
    public static final String LATEST_CLICKS_META = LATEST_CLICKS + ".meta";
    public static final String LATEST_CLICKS_GOOGLE = LATEST_CLICKS + ".google";
    public static final String LATEST_CLICKS_REDDIT = LATEST_CLICKS + ".reddit";
    public static final String LATEST_CLICKS_LINKEDIN = LATEST_CLICKS + ".linkedin";

    public static final List<String> URLS = List.of(REFERRER, LANDING_URL);
}
