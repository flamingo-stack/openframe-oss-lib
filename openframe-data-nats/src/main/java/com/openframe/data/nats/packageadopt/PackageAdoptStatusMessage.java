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

    public enum State {
        DONE,
        FAILED
    }
}
