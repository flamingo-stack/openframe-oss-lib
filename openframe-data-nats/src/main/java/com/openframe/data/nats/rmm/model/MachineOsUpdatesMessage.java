package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.time.Instant;
import java.util.List;

// The agent's report as it is on the wire. Enum-like values stay strings here: the agent adds values before the
// backend learns them, and a report must not fail on one.
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MachineOsUpdatesMessage {

    public static final String STREAM = "MACHINE_OS_UPDATES";
    public static final String SUBJECT_FILTER = "machine.*.os-updates";

    private Instant reportedAt;
    private String platform;

    private String osVersion;
    private String osBuild;
    private String osProductName;

    private String rebootPending;
    private String osUpdateAuthorization;
    private Manageability manageability;

    private String patchState;
    private String scanState;
    private Instant lastScanAt;

    private UpdateSet updates;
    private LastOsInstall lastOsInstall;

    private WindowsDetails windows;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Manageability {

        private String state;
        private List<String> reasons;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateSet {

        private String confidence;

        // Absent = the device could not read its updates. Empty = it read them and nothing applies.
        private List<UpdateItem> items;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateItem {

        private String identifier;
        private String displayName;
        private String displayVersion;
        private MacosUpdate macos;
        private WindowsUpdate windows;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MacosUpdate {

        private String presence;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WindowsUpdate {

        private List<String> kbArticleIds;
        private String msrcSeverity;
        private List<WindowsUpdateCategory> categories;
        private List<String> cveIds;
        private Instant publishedAt;
        private Long maxDownloadBytes;
        private Boolean isDownloaded;
        private String rebootBehavior;
        private Boolean browseOnly;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WindowsUpdateCategory {

        private String name;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LastOsInstall {

        private String identifier;
        private String displayName;
        private String displayVersion;
        private Instant installedAt;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WindowsDetails {

        private List<WindowsHistoryEntry> history;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WindowsHistoryEntry {

        private String updateId;
        private Integer revision;
        private String title;
        private Instant installedAt;
        private String operation;
        private String resultCode;
        private Long hresult;
    }
}
