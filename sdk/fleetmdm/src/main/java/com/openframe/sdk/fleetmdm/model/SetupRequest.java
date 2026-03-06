package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class SetupRequest {

    @JsonProperty("admin")
    private AdminInfo admin;

    @JsonProperty("org_info")
    private OrgInfo orgInfo;

    @JsonProperty("server_url")
    private String serverUrl;

    public static class AdminInfo {
        private String email;
        private String password;
        private String name;

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    public static class OrgInfo {
        @JsonProperty("org_name")
        private String orgName;

        public String getOrgName() { return orgName; }
        public void setOrgName(String orgName) { this.orgName = orgName; }
    }
}
