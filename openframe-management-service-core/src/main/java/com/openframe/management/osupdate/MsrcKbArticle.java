package com.openframe.management.osupdate;

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
    // Null = no CVE of the KB has a rating.
    OsUpdateSeverity severity;
    boolean exploited;
}
