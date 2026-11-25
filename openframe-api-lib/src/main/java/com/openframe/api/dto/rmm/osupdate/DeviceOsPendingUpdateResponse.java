package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class DeviceOsPendingUpdateResponse {

    private String identifier;
    private String displayName;
    private String displayVersion;
    private List<String> kbArticleIds;
    private OsUpdateSeverity severity;
    private List<String> categories;
    private List<String> categoryIds;
    private OsUpdateType updateType;
    private List<String> cveIds;
    private Instant publishedAt;
    private Long sizeBytes;
    private OsUpdateRebootBehavior rebootBehavior;
    private Boolean browseOnly;
    private Instant discoveredAt;
    private Boolean downloaded;
    private MacosUpdatePresence macosPresence;
}
