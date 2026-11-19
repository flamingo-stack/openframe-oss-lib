package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRestartBehaviour;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class DeviceOsUpdateResponse {

    private String updateKey;
    private String title;
    private String version;
    private List<String> kbArticleIds;
    private OsUpdateSeverity severity;
    private List<String> categories;
    private Boolean browseOnly;
    private Instant publishedAt;
    private Long sizeBytes;
    private OsUpdateRestartBehaviour restartBehaviour;
    private Instant discoveredAt;
}
