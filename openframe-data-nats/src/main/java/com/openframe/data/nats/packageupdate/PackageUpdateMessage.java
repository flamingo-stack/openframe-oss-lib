package com.openframe.data.nats.packageupdate;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageUpdateMessage implements DeliveryPayload {

    private DeliveryRef delivery;

    private String requestId;

    private UpdateSource source;

    @JsonProperty("package")
    private PackageReference packageRef;

    private PackageUpdateMode mode;

    private Integer countdownSeconds;
}
