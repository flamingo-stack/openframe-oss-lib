package com.openframe.api.dto.oidc;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OpenIDConfiguration {
    private String issuer;
    @JsonProperty("authorization_endpoint")
    private String authorizationEndpoint;
    @JsonProperty("token_endpoint")
    private String tokenEndpoint;
    @JsonProperty("userinfo_endpoint")
    private String userinfoEndpoint;
    @JsonProperty("jwks_uri")
    private String jwksUri;
    @JsonProperty("response_types_supported")
    private List<String> responseTypesSupported;
    @JsonProperty("subject_types_supported")
    private List<String> subjectTypesSupported;
    @JsonProperty("id_token_signing_alg_values_supported")
    private List<String> idTokenSigningAlgValuesSupported;
    @JsonProperty("scopes_supported")
    private List<String> scopesSupported;
    @JsonProperty("token_endpoint_auth_methods_supported")
    private List<String> tokenEndpointAuthMethodsSupported;
    @JsonProperty("claims_supported")
    private List<String> claimsSupported;
} 