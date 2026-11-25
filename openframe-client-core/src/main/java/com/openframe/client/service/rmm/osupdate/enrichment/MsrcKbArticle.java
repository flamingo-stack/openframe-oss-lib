package com.openframe.client.service.rmm.osupdate.enrichment;

import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import lombok.Builder;
import lombok.Value;

import java.util.List;

// What one monthly MSRC bulletin says about the CVEs one KB fixes.
@Value
@Builder
public class MsrcKbArticle {

    String kbArticleId;
    List<String> cveIds;
    // Null = no CVE of the KB has a rating or a score.
    OsUpdateSeverity severity;
    Double cvssScore;
    boolean exploited;
}
