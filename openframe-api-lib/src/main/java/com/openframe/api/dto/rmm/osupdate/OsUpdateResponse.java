package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateResponse {

    private String id;
    private OsPlatform platform;
    private String identifier;
    private String displayName;
    private String displayVersion;
    private List<String> kbArticleIds;
    private OsUpdateSeverity severity;
    private List<String> categories;
    private List<String> categoryIds;
    private OsUpdateType updateType;
    private OsUpdateClassification classification;
    private List<String> cveIds;
    private Instant publishedAt;
    private Long sizeBytes;
    private OsUpdateRebootBehavior rebootBehavior;
    private Boolean browseOnly;
    private Double cvssScore;
    private Boolean exploited;
    private List<String> supersededBy;
    private Instant enrichedAt;
    private Instant firstSeenAt;
    private String cursor;
}
