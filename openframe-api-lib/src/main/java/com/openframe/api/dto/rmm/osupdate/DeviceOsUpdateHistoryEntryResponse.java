package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class DeviceOsUpdateHistoryEntryResponse {

    private String updateKey;
    private String title;
    private String version;
    private Instant installedAt;
    private OsUpdateOperation operation;
    private OsUpdateInstallResult result;
    private String errorCode;
    private String cursor;
}
