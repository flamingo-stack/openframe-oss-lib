package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class CreateUserRequest {

    private String name;
    private String email;
    private String password;

    @JsonProperty("global_role")
    private String globalRole;

    @JsonProperty("api_only")
    private boolean apiOnly;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getGlobalRole() { return globalRole; }
    public void setGlobalRole(String globalRole) { this.globalRole = globalRole; }

    public boolean isApiOnly() { return apiOnly; }
    public void setApiOnly(boolean apiOnly) { this.apiOnly = apiOnly; }
}
