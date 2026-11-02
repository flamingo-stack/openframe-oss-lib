package com.openframe.data.nats.packageupdate;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageUpdateStatusMessage {

    public static final String STREAM = "PACKAGE_UPDATE_STATUS";
    public static final String SUBJECT_FILTER = "machine.*.package-update.status";

    private String eventId;
    private String requestId;
    private String machineId;
    private Instant at;

    private UpdateSource source;

    @JsonProperty("package")
    private PackageReference packageRef;

    private String installedVersion;
    private String availableVersion;

    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private State state;

    private Waiting waiting;
    private Done done;
    private Failed failed;

    public enum State {
        WAITING,
        DONE,
        FAILED
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Waiting {

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private Reason reason;

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private Phase phase;

        private List<Holder> holders;

        private Instant closesAt;

        public enum Reason {
            APP_RUNNING,
            MANAGER_BUSY,
            NO_USER_SESSION
        }

        public enum Phase {
            PROMPT,
            COUNTDOWN
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Holder {
        private String app;
        private String user;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Done {

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private Result result;

        private Boolean rebootRequired;
        private Boolean relaunched;

        public enum Result {
            UPGRADED,
            ALREADY_LATEST
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Failed {

        @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
        private Reason reason;

        private Long exitCode;
        private String message;

        public enum Reason {
            MANAGER_ERROR,
            MANAGER_MISSING,
            CLOSE_FAILED,
            TIMEOUT,
            NOT_SUPPORTED,
            SUPERSEDED,
            NOT_INSTALLED,
            NOT_UPGRADABLE
        }
    }
}
