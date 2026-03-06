package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class CreateUserRequest {

    private String name;
    private String email;
    private String password;

    @JsonProperty("global_role")
    private String globalRole;

    @JsonProperty("api_only")
    private boolean apiOnly;

}
