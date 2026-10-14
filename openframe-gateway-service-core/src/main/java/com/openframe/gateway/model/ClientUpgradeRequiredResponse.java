package com.openframe.gateway.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClientUpgradeRequiredResponse {

    public static final String CODE = "CLIENT_UPGRADE_REQUIRED";

    private final String code;
    private final String minBundleVersion;
    private final String storeUrl;
}
