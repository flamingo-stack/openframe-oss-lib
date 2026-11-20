package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageAdoptMessage implements DeliveryPayload {

    private DeliveryRef delivery;

    private String requestId;

    @JsonProperty("package")
    private PackageReference packageRef;

    private String bundleId;
}
