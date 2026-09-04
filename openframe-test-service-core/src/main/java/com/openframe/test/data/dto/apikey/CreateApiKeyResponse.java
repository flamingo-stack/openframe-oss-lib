package com.openframe.test.data.dto.apikey;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response to {@code POST /api/api-keys}. Mirrors {@code com.openframe.api.dto.CreateApiKeyResponse}.
 *
 * <p>{@link #fullKey} — {@code ak_<keyId>.sk_<secret>} — is returned <em>only</em> here. The secret half
 * is stored hashed, so a key whose {@code fullKey} is dropped can never be recovered, only regenerated.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateApiKeyResponse {

    private ApiKeyResponse apiKey;

    private String fullKey;
}
