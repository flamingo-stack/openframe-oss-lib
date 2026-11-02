package com.openframe.data.nats.packageupdate;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateSource {

    private Kind kind;
    private Origin origin;

    public enum Kind {
        AUTO,
        MANUAL
    }

    public enum Origin {
        ADMIN,
        USER
    }
}
