package com.openframe.data.nats.packageadopt;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.Instant;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageAdoptStatusMessage {

    public static final String STREAM = "PACKAGE_ADOPT_STATUS";
    public static final String SUBJECT_FILTER = "machine.*.package-adopt.status";

    private String eventId;
    private String requestId;
    private String machineId;
    private Instant at;

    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private State state;

    private String message;

    // DONE only; absent from older agents
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private Outcome outcome;
    private Boolean restartRequired;

    // FAILED only: the agent's code (MANAGER_MISSING, IDENTITY_MISMATCH, INSTALL_FAILED, ...), a string as the agent owns
    // the list
    private String reason;

    public enum State {
        DONE,
        FAILED
    }

    public enum Outcome {
        ADOPTED_IN_PLACE,
        REINSTALLED,
        ALREADY_MANAGED
    }
}
