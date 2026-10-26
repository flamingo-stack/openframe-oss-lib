package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Setter
@Getter
public class SetupRequest {

    @JsonProperty("admin")
    private AdminInfo admin;

    @JsonProperty("org_info")
    private OrgInfo orgInfo;

    @JsonProperty("server_url")
    private String serverUrl;

    @Getter
    @Setter
    @ToString
    public static class AdminInfo {
        private String email;
        @ToString.Exclude
        private String password;
        private String name;
    }

    @Getter
    @Setter
    public static class OrgInfo {
        @JsonProperty("org_name")
        private String orgName;
    }
}
