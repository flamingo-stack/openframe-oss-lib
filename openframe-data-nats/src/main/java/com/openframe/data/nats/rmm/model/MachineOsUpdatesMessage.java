package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagedElsewhereReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagementState;
import com.openframe.data.document.rmm.osupdate.OsUpdateObservedReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartBehaviour;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MachineOsUpdatesMessage {

    public static final String STREAM = "MACHINE_OS_UPDATES";
    public static final String SUBJECT_FILTER = "machine.*.os-updates";

    private OsState osState;
    private List<PendingUpdate> pendingUpdates;
    private List<InstalledUpdate> installHistory;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OsState {

        private String osVersion;
        private String osBuild;
        private Boolean restartPending;
        private Instant lastScanAt;
        private String lastScanError;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateManagementState managementState;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateManagedElsewhereReason managedElsewhereReason;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateObservedReason observedReason;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateAuthorization osUpdateAuthorization;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PendingUpdate {

        private String updateKey;
        private String title;
        private String version;
        private List<String> kbArticleIds;
        private String msrcSeverity;
        private List<Category> categories;
        private Boolean browseOnly;
        private Instant publishedAt;
        private Long sizeBytes;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateRestartBehaviour restartBehaviour;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Category {

        private String id;
        private String name;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InstalledUpdate {

        private String updateKey;
        private String title;
        private String version;
        private Instant installedAt;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateOperation operation;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private OsUpdateInstallResult result;

        private String hresult;
    }
}
